"""Geo helpers for distance-based property search."""

from __future__ import annotations

import math
from typing import Any


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(min(1.0, a)))


def min_distance_km(lat: float, lng: float, anchors: list[dict]) -> float | None:
    if not anchors:
        return None
    dists = [haversine_km(lat, lng, a["lat"], a["lng"]) for a in anchors if a.get("lat") is not None]
    return min(dists) if dists else None


def property_coords(
    *,
    listing_lat: float | None = None,
    listing_lng: float | None = None,
    spec_lat: float | None = None,
    spec_lng: float | None = None,
) -> tuple[float, float] | None:
    if listing_lat is not None and listing_lng is not None:
        return listing_lat, listing_lng
    if spec_lat is not None and spec_lng is not None:
        return spec_lat, spec_lng
    return None


def distance_bucket(
    distance_km: float | None,
    primary_radius: float,
    *,
    has_anchors: bool,
) -> str:
    if primary_radius <= 0 or not has_anchors:
        return "in_city"
    if distance_km is None:
        return "in_city"
    if distance_km <= primary_radius:
        return "within_radius"
    if distance_km <= 10:
        return "within_10km"
    return "in_city"


def build_anchors(req: Any, contact: Any | None = None) -> list[dict]:
    anchors: list[dict] = []
    if req.location_anchors:
        anchors.extend(req.location_anchors)
    if contact and contact.workplace_lat is not None and contact.workplace_lng is not None:
        wp = {
            "name": contact.workplace_text or "Workplace",
            "lat": contact.workplace_lat,
            "lng": contact.workplace_lng,
        }
        if not any(a.get("lat") == wp["lat"] and a.get("lng") == wp["lng"] for a in anchors):
            anchors.insert(0, wp)
    return anchors
