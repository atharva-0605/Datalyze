import numpy as np
from typing import List, Dict, Any

class MLEngineService:
    def forecast_trend(self, historical_data: List[float], horizon_days: int = 30, what_if_growth: float = 0.0) -> Dict[str, Any]:
        """Project a 30/60/90-day horizon window from historical numerical inputs using linear regression."""
        n = len(historical_data)
        if n < 2:
            val = historical_data[0] if n == 1 else 0.0
            projection = [val] * horizon_days
            what_if = [val * (1 + what_if_growth / 100.0)] * horizon_days
            return {
                "projection": projection,
                "what_if_baseline": what_if,
                "slope": 0.0,
                "intercept": val
            }
            
        x = np.arange(n)
        y = np.array(historical_data)
        
        x_mean = np.mean(x)
        y_mean = np.mean(y)
        
        num = np.sum((x - x_mean) * (y - y_mean))
        den = np.sum((x - x_mean) ** 2)
        
        slope = num / den if den != 0 else 0.0
        intercept = y_mean - slope * x_mean
        
        projection = []
        what_if_baseline = []
        
        for day in range(1, horizon_days + 1):
            future_idx = n - 1 + day
            forecast_val = slope * future_idx + intercept
            if forecast_val < 0:
                forecast_val = 0.0
            projection.append(round(float(forecast_val), 2))
            
            what_if_val = forecast_val * (1 + what_if_growth / 100.0)
            if what_if_val < 0:
                what_if_val = 0.0
            what_if_baseline.append(round(float(what_if_val), 2))
            
        return {
            "projection": projection,
            "what_if_baseline": what_if_baseline,
            "slope": float(slope),
            "intercept": float(intercept)
        }

    def kmeans_clustering(self, data_points: List[float], k: int = 3) -> Dict[str, Any]:
        """Groups data points into K clusters and assigns plain-English labels."""
        n = len(data_points)
        if n == 0:
            return {"assignments": [], "centroids": [], "labels": {}}
            
        points = np.array(data_points)
        k = min(k, n)
        
        sorted_pts = np.sort(points)
        indices = np.linspace(0, n - 1, k, dtype=int)
        centroids = sorted_pts[indices].astype(float)
        
        assignments = np.zeros(n, dtype=int)
        for _ in range(10):
            distances = np.abs(points[:, np.newaxis] - centroids)
            assignments = np.argmin(distances, axis=1)
            
            for c_idx in range(k):
                members = points[assignments == c_idx]
                if len(members) > 0:
                    centroids[c_idx] = float(np.mean(members))
                    
        sorted_centroid_indices = np.argsort(centroids)
        labels_map = {}
        if k == 1:
            labels_map[0] = "General"
        elif k == 2:
            labels_map[sorted_centroid_indices[0]] = "Low Value"
            labels_map[sorted_centroid_indices[1]] = "High Value"
        else:
            labels_map[sorted_centroid_indices[0]] = "Low Value"
            labels_map[sorted_centroid_indices[1]] = "Medium Value"
            for i in range(2, k):
                labels_map[sorted_centroid_indices[i]] = "High Value" if i == 2 else "Premium Value"
                
        final_assignments = []
        for idx, pt in enumerate(data_points):
            c_idx = int(assignments[idx])
            final_assignments.append({
                "value": float(pt),
                "cluster_id": c_idx,
                "label": labels_map[c_idx]
            })
            
        return {
            "assignments": final_assignments,
            "centroids": [float(c) for c in centroids],
            "labels": {str(c_id): lbl for c_id, lbl in labels_map.items()}
        }

ml_engine_service = MLEngineService()
