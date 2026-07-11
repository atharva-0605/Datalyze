import logging
import difflib
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.schema_mapper import SchemaMapping

logger = logging.getLogger("app.services.schema_mapper")

class SelfLearningSchemaMapperService:
    async def analyze_incoming_schema(
        self, 
        workspace_id: int, 
        uploaded_columns: List[str], 
        target_columns: List[str], 
        db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """
        Iterates through incoming column names, checks against historical confirmed mappings,
        and uses difflib SequenceMatcher to suggest matches with confidence status ratings.
        """
        # 1. Fetch previously confirmed mappings for the workspace
        stmt = select(SchemaMapping).where(SchemaMapping.workspace_id == workspace_id)
        res = await db.execute(stmt)
        mappings = res.scalars().all()
        confirmed_map = {m.detected_header.lower().strip(): m.mapped_header for m in mappings}

        suggestions = []
        target_set = {t.lower().strip(): t for t in target_columns}

        for uploaded_col in uploaded_columns:
            col_cleaned = uploaded_col.lower().strip()
            
            # Case 1: Exact target column match (ignoring case)
            if col_cleaned in target_set:
                suggestions.append({
                    "detected_header": uploaded_col,
                    "mapped_header": target_set[col_cleaned],
                    "confidence_score": 1.0,
                    "confidence_rating": "HIGH",
                    "historical": False
                })
                continue
                
            # Case 2: Historical mapping exists
            if col_cleaned in confirmed_map:
                suggestions.append({
                    "detected_header": uploaded_col,
                    "mapped_header": confirmed_map[col_cleaned],
                    "confidence_score": 1.0,
                    "confidence_rating": "HIGH",
                    "historical": True
                })
                continue

            # Case 3: Novel column name -> run SequenceMatcher similarity check
            best_match = None
            best_score = 0.0

            for target in target_columns:
                target_cleaned = target.lower().strip()
                score = difflib.SequenceMatcher(None, col_cleaned, target_cleaned).ratio()
                
                # Check parts matching (e.g. 'rev' in 'revenue' should score higher)
                if col_cleaned in target_cleaned or target_cleaned in col_cleaned:
                    score = max(score, 0.70)
                
                if score > best_score:
                    best_score = score
                    best_match = target

            confidence_rating = "LOW"
            if best_score >= 0.85:
                confidence_rating = "HIGH"
            elif best_score >= 0.50:
                confidence_rating = "MEDIUM"

            suggestions.append({
                "detected_header": uploaded_col,
                "mapped_header": best_match if best_match else target_columns[0],
                "confidence_score": round(float(best_score), 3),
                "confidence_rating": confidence_rating,
                "historical": False
            })

        return suggestions

    async def confirm_mappings(
        self, 
        workspace_id: int, 
        mappings_list: List[Dict[str, Any]], 
        db: AsyncSession
    ) -> None:
        """
        Explicitly saves user-approved layout maps back to schema_mappings.
        """
        for mapping in mappings_list:
            detected = mapping.get("detected_header")
            mapped = mapping.get("mapped_header")
            score = float(mapping.get("confidence_score", 1.0))
            
            if not detected or not mapped:
                continue

            # Check if this mapping already exists to prevent duplicate entries
            stmt = select(SchemaMapping).where(
                SchemaMapping.workspace_id == workspace_id,
                SchemaMapping.detected_header == detected
            )
            res = await db.execute(stmt)
            existing = res.scalars().first()

            if existing:
                existing.mapped_header = mapped
                existing.confidence_score = score
            else:
                new_map = SchemaMapping(
                    workspace_id=workspace_id,
                    detected_header=detected,
                    mapped_header=mapped,
                    confidence_score=score
                )
                db.add(new_map)

        await db.commit()

schema_mapper_service = SelfLearningSchemaMapperService()
