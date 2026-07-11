import os
import logging
from datetime import datetime
from jinja2 import Template
from app.core.config import settings

logger = logging.getLogger("app.services.report_engine")

# Safely attempt to load WeasyPrint to guard against Windows GTK+ setup issues
weasyprint_available = False
try:
    import sys
    import io
    original_stdout = sys.stdout
    original_stderr = sys.stderr
    sys.stdout = io.StringIO()
    sys.stderr = io.StringIO()
    try:
        import weasyprint
        weasyprint_available = True
    finally:
        sys.stdout = original_stdout
        sys.stderr = original_stderr
except Exception as e:
    logger.debug(
        f"WeasyPrint is not fully configured (missing GTK libraries on Windows?): {e}. "
        "PDF generation requests will automatically export HTML report files instead."
    )

class ReportEngineService:
    DEFAULT_HTML_TEMPLATE = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>{{ title }}</title>
        <style>
            @page {
                size: A4;
                margin: 20mm;
            }
            body {
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                color: #2c3e50;
                line-height: 1.6;
                background-color: #f8fafc;
                margin: 0;
                padding: 0;
            }
            .header-container {
                background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                color: #ffffff;
                padding: 30px;
                border-radius: 12px;
                margin-bottom: 30px;
            }
            h1 {
                margin: 0 0 10px 0;
                font-size: 28px;
                font-weight: 700;
            }
            .subtitle {
                font-size: 16px;
                opacity: 0.9;
                margin: 0;
            }
            .meta-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
                margin-top: 20px;
                border-top: 1px solid rgba(255, 255, 255, 0.2);
                padding-top: 15px;
                font-size: 14px;
            }
            .card {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 20px;
                margin-bottom: 25px;
            }
            .card-title {
                font-size: 18px;
                font-weight: 600;
                color: #1e3c72;
                margin-top: 0;
                margin-bottom: 15px;
                border-bottom: 2px solid #e2e8f0;
                padding-bottom: 8px;
            }
            .score-container {
                display: flex;
                align-items: center;
                margin-bottom: 20px;
            }
            .score-badge {
                font-size: 32px;
                font-weight: 700;
                color: #ffffff;
                background-color: {{ '#22c55e' if health_score >= 80 else ('#eab308' if health_score >= 50 else '#ef4444') }};
                padding: 8px 18px;
                border-radius: 8px;
                display: inline-block;
                margin-right: 20px;
            }
            .stats-table {
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
            }
            .stats-table th, .stats-table td {
                padding: 10px 12px;
                text-align: left;
                border-bottom: 1px solid #e2e8f0;
            }
            .stats-table th {
                background-color: #f1f5f9;
                color: #475569;
                font-weight: 600;
            }
            .bullet-list {
                padding-left: 20px;
                margin: 10px 0;
            }
            .bullet-list li {
                margin-bottom: 8px;
            }
            .footer {
                text-align: center;
                font-size: 12px;
                color: #94a3b8;
                margin-top: 50px;
                border-top: 1px solid #e2e8f0;
                padding-top: 15px;
            }
        </style>
    </head>
    <body>
        <div class="header-container">
            <h1>{{ title }}</h1>
            <p class="subtitle">Automated Data Quality & Diagnostics Report</p>
            <div class="meta-grid">
                <div><strong>Dataset Name:</strong> {{ filename }}</div>
                <div><strong>Workspace ID:</strong> Workspace {{ workspace_id }}</div>
                <div><strong>Generated At:</strong> {{ generated_at }}</div>
                <div><strong>File Size:</strong> {{ (file_size / 1024) | round(2) }} KB</div>
            </div>
        </div>

        <div class="card">
            <div class="card-title">Data Health Summary</div>
            <div class="score-container">
                <span class="score-badge">{{ health_score }} / 100</span>
                <div>
                    <strong>Data Integrity Rating:</strong> 
                    {% if health_score >= 80 %} Excellent
                    {% elif health_score >= 50 %} Moderate Issues
                    {% else %} Critical Mismatches
                    {% endif %}
                </div>
            </div>
            
            <table class="stats-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Total Rows</td>
                        <td>{{ summary.total_rows }}</td>
                        <td>100%</td>
                    </tr>
                    <tr>
                        <td>Total Columns</td>
                        <td>{{ summary.total_columns }}</td>
                        <td>-</td>
                    </tr>
                    <tr>
                        <td>Missing Cells</td>
                        <td>{{ summary.missing_cells }}</td>
                        <td>{{ summary.missing_percentage }}%</td>
                    </tr>
                    <tr>
                        <td>Duplicate Rows</td>
                        <td>{{ summary.duplicate_rows }}</td>
                        <td>{{ summary.duplicate_percentage }}%</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="card">
            <div class="card-title">Column Details</div>
            <table class="stats-table">
                <thead>
                    <tr>
                        <th>Column Name</th>
                        <th>Datatype</th>
                        <th>Missing Count</th>
                        <th>Mismatches</th>
                    </tr>
                </thead>
                <tbody>
                    {% for col_name, col_data in columns.items() %}
                    <tr>
                        <td><strong>{{ col_name }}</strong></td>
                        <td><code>{{ col_data.type }}</code></td>
                        <td>{{ col_data.missing_count }} ({{ col_data.missing_percentage }}%)</td>
                        <td>{{ col_data.mismatch_count }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>

        {% if suggested_actions %}
        <div class="card">
            <div class="card-title">Recommended Actions</div>
            <ul class="bullet-list">
                {% for action in suggested_actions %}
                <li>{{ action }}</li>
                {% endfor %}
            </ul>
        </div>
        {% endif %}

        {% if custom_notes %}
        <div class="card">
            <div class="card-title">Analyst Notes</div>
            <p>{{ custom_notes }}</p>
        </div>
        {% endif %}

        <div class="footer">
            Generated by Datalyze AI. Powered by FastAPI, Pandas & WeasyPrint.
        </div>
    </body>
    </html>
    """

    def generate_report_html(
        self, 
        dataset_metadata: dict, 
        profile_report: dict, 
        title: str, 
        custom_notes: str = None
    ) -> str:
        """Renders parameters into the HTML data audit report template."""
        template = Template(self.DEFAULT_HTML_TEMPLATE)
        
        render_context = {
            "title": title,
            "filename": dataset_metadata.get("filename", "Unknown_Dataset"),
            "file_size": dataset_metadata.get("file_size", 0),
            "workspace_id": dataset_metadata.get("workspace_id", "N/A"),
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "health_score": profile_report.get("health_score", 0.0),
            "summary": profile_report.get("summary", {}),
            "columns": profile_report.get("columns", {}),
            "suggested_actions": profile_report.get("suggested_actions", []),
            "custom_notes": custom_notes,
        }
        return template.render(render_context)

    def compile_html_to_pdf(self, html_content: str, output_pdf_path: str) -> str:
        """Compiles HTML into a local PDF file. Falls back to exporting HTML file if WeasyPrint fails."""
        os.makedirs(os.path.dirname(output_pdf_path), exist_ok=True)
        
        if weasyprint_available:
            try:
                weasyprint.HTML(string=html_content).write_pdf(output_pdf_path)
                logger.info(f"Successfully compiled PDF report: {output_pdf_path}")
                return output_pdf_path
            except Exception as e:
                logger.error(f"Failed to generate PDF via WeasyPrint: {e}. Defaulting to HTML.")
        
        # Fail-safe mode: export to HTML
        html_fallback_path = output_pdf_path.replace(".pdf", ".html")
        try:
            with open(html_fallback_path, "w", encoding="utf-8") as f:
                f.write(html_content)
            logger.info(f"Fallback HTML report written: {html_fallback_path}")
            return html_fallback_path
        except Exception as e:
            logger.error(f"Failed to write fallback HTML report: {e}")
            raise

report_engine_service = ReportEngineService()
