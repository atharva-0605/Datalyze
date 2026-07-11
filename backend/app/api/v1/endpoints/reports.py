import os
import pandas as pd
import tempfile
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_workspace_id
from app.models.user import User
from app.models.dataset import Dataset
from app.schemas.report import ReportRequest
from app.services.report_engine import report_engine_service

router = APIRouter()

@router.post("/generate")
async def generate_report(
    payload: ReportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Generates an HTML or PDF data quality audit report and returns it as a direct download."""
    result = await db.execute(
        select(Dataset).where(
            Dataset.uuid == payload.dataset_uuid,
            Dataset.workspace_id == current_user.workspace_id
        )
    )
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(
            status_code=404, 
            detail="Dataset not found in this workspace context."
        )
        
    if not dataset.health_report:
        raise HTTPException(
            status_code=400, 
            detail="Dataset profile is missing. Please run diagnostics first."
        )
        
    # Setup reports directory inside workspace context
    workspace_reports_dir = os.path.abspath(
        os.path.join(os.path.dirname(dataset.storage_path), "..", "reports")
    )
    os.makedirs(workspace_reports_dir, exist_ok=True)
    
    output_filename = f"report_{dataset.uuid}.pdf"
    output_path = os.path.join(workspace_reports_dir, output_filename)
    
    # 1. Renders HTML format
    html_content = report_engine_service.generate_report_html(
        dataset_metadata={
            "filename": dataset.filename,
            "file_size": dataset.file_size,
            "workspace_id": current_user.workspace_id
        },
        profile_report=dataset.health_report,
        title=payload.title,
        custom_notes=payload.custom_notes
    )
    
    # 2. Compile locally using WeasyPrint (falls back to plain HTML file if GTK is missing)
    compiled_path = report_engine_service.compile_html_to_pdf(html_content, output_path)
    
    # Determine proper download file types
    if compiled_path.endswith(".html"):
        media_type = "text/html"
        download_name = f"report_{dataset.filename}.html"
    else:
        media_type = "application/pdf"
        download_name = f"report_{dataset.filename}.pdf"
        
    return FileResponse(
        compiled_path,
        media_type=media_type,
        filename=download_name
    )

@router.get("/export-bi")
async def export_bi_report(
    dataset_uuid: str,
    total_sales: float = 0.0,
    total_profit: float = 0.0,
    total_tax: float = 0.0,
    forecast_projection: str = "",
    what_if_baseline: str = "",
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """Saves active state into a fixed Excel path and streams the master pbix template file."""
    result = await db.execute(
        select(Dataset).where(
            Dataset.uuid == dataset_uuid,
            Dataset.workspace_id == workspace_id
        )
    )
    dataset = result.scalars().first()
    if not dataset:
        raise HTTPException(
            status_code=404, 
            detail="Dataset not found in this workspace context."
        )
        
    from app.services.doctor import doctor_service
    try:
        df = doctor_service.load_dataframe(dataset.storage_path)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load dataset: {str(e)}"
        )
        
    # Construct forecast rows
    proj_vals = [float(x) for x in forecast_projection.split(",") if x.strip()] if forecast_projection else []
    base_vals = [float(x) for x in what_if_baseline.split(",") if x.strip()] if what_if_baseline else []
    forecast_len = max(len(proj_vals), len(base_vals))
    forecast_rows = []
    for i in range(forecast_len):
        forecast_rows.append({
            "Day": f"Day +{i+1}",
            "Forecast_Projection": proj_vals[i] if i < len(proj_vals) else None,
            "What_If_Baseline": base_vals[i] if i < len(base_vals) else None
        })
    df_forecast = pd.DataFrame(forecast_rows)
    
    # Construct KPI rows
    df_kpis = pd.DataFrame([
        {"Metric": "Total Sales Volume", "Value": total_sales},
        {"Metric": "Gross Profit", "Value": total_profit},
        {"Metric": "Tax (VAT 5%)", "Value": total_tax}
    ])
    
    # Write to a fixed local data delivery path (e.g. ./tmp/BI_Export_Dashboard.xlsx)
    os.makedirs("./tmp", exist_ok=True)
    fixed_data_path = os.path.abspath("./tmp/BI_Export_Dashboard.xlsx")
    
    try:
        with pd.ExcelWriter(fixed_data_path, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="Raw_Data", index=False)
            df_kpis.to_excel(writer, sheet_name="Simulated_KPIs", index=False)
            df_forecast.to_excel(writer, sheet_name="ML_Forecast", index=False)
            
            # Auto-adjust column widths
            for sheet_name in writer.sheets:
                worksheet = writer.sheets[sheet_name]
                from openpyxl.utils import get_column_letter
                for col in worksheet.columns:
                    max_len = max(len(str(cell.value or '')) for cell in col)
                    col_letter = get_column_letter(col[0].column)
                    worksheet.column_dimensions[col_letter].width = max(max_len + 3, 12)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate fixed Excel data payload: {str(e)}"
        )
        
    template_path = os.path.abspath("./storage/templates/Datalyze_Presentation_Master.pbix")
    if not os.path.exists(template_path):
        raise HTTPException(
            status_code=404,
            detail="Power BI master presentation template not found."
        )
        
    import zipfile
    import json
    import io
    from fastapi.responses import StreamingResponse
    
    try:
        # Load the base pbix archive in-memory
        with zipfile.ZipFile(template_path, 'r') as zin:
            content_map = {name: zin.read(name) for name in zin.namelist()}
            
        layout_bytes = content_map.get("Report/Layout")
        if layout_bytes:
            layout_str = layout_bytes.decode("utf-16-le")
            layout = json.loads(layout_str)
            
            # Collect visual containers from all pages
            all_visuals = []
            for s in layout.get("sections", []):
                all_visuals.extend(s.get("visualContainers", []))
                
            # Configure Section 1 (Page 1) as a unified widescreen master page
            section = layout["sections"][0]
            section["name"] = "Executive_Dashboard_Canvas"
            section["displayName"] = "Executive Dashboard"
            section["width"] = 1280
            section["height"] = 960
            section["config"] = "{\"config\":{\"pageSizeType\":0}}"
            
            new_visuals = []
            
            for v in all_visuals:
                config_str = v.get("config", "{}")
                v_type = None
                try:
                    config = json.loads(config_str)
                    v_type = config.get("singleVisual", {}).get("visualType")
                except Exception:
                    pass
                    
                # Reconstruct visual layout coordinates matching three-row application structure
                if v_type == "map":
                    # Executive KPI Summary Ribbon (Row 1)
                    v["x"] = 20
                    v["y"] = 20
                    v["width"] = 1240
                    v["height"] = 140
                    new_visuals.append(v)
                elif v_type == "columnChart":
                    # Row 2 Left Panel (Total by Branch column chart)
                    v["x"] = 20
                    v["y"] = 180
                    v["width"] = 600
                    v["height"] = 360
                    new_visuals.append(v)
                elif v_type == "lineClusteredColumnComboChart":
                    # Row 2 Right Panel (Profit & Tax Combo Chart)
                    v["x"] = 640
                    v["y"] = 180
                    v["width"] = 620
                    v["height"] = 360
                    new_visuals.append(v)
                elif v_type == "lineChart":
                    # Row 3 Lower Left (Total Sales Trend by Date Line Chart)
                    v["x"] = 20
                    v["y"] = 560
                    v["width"] = 600
                    v["height"] = 360
                    new_visuals.append(v)
                elif v_type == "pieChart":
                    # Row 3 Lower Right (Quantity by City Donut Visual)
                    v["x"] = 640
                    v["y"] = 560
                    v["width"] = 620
                    v["height"] = 360
                    new_visuals.append(v)
                else:
                    # Place extra or unmapped visuals offscreen
                    v["x"] = -1000
                    v["y"] = -1000
                    v["width"] = 0
                    v["height"] = 0
                    new_visuals.append(v)
                    
            section["visualContainers"] = new_visuals
            layout["sections"] = [section]
            
            # Repack updated Layout
            new_layout_str = json.dumps(layout)
            content_map["Report/Layout"] = new_layout_str.encode("utf-16-le")
            
        # Compile final zip container stream
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zout:
            for name, data in content_map.items():
                zout.writestr(name, data)
        zip_buffer.seek(0)
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to rebuild Power BI layout metadata: {str(e)}"
        )
        
    return StreamingResponse(
        zip_buffer,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": "attachment; filename=Datalyze_Presentation.pbix",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

from pydantic import BaseModel

class PresentationRequest(BaseModel):
    selected_sections: list

@router.post("/generate-presentation")
async def generate_executive_presentation_endpoint(
    payload: PresentationRequest,
    current_user: User = Depends(get_current_user),
    workspace_id: int = Depends(get_current_workspace_id),
    db: AsyncSession = Depends(get_db)
):
    """
    POST endpoint compiling active workspace dashboard states into a premium slide deck.
    Enforces tenant context isolation.
    """
    try:
        from app.services.report_generator import report_generator_service
        file_path = await report_generator_service.generate_executive_presentation(
            workspace_id=workspace_id,
            selected_sections=payload.selected_sections,
            db=db
        )
        if not os.path.exists(file_path):
            raise HTTPException(status_code=500, detail="Generated file not found on server.")
            
        return FileResponse(
            file_path,
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            filename=os.path.basename(file_path),
            headers={
                "Content-Disposition": f"attachment; filename={os.path.basename(file_path)}",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate corporate presentation: {str(e)}")


