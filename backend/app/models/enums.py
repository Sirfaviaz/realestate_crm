import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"


class StreamType(str, enum.Enum):
    SALES = "sales"
    RENTAL = "rental"


class ContactRole(str, enum.Enum):
    BUYER = "buyer"
    SELLER = "seller"
    RENTER = "renter"
    LANDLORD = "landlord"


class Urgency(str, enum.Enum):
    URGENT = "urgent"
    SOON = "soon"
    FLEXIBLE = "flexible"
    BROWSING = "browsing"


class LeadScore(str, enum.Enum):
    HOT = "hot"
    WARM = "warm"
    COLD = "cold"


class DealStage(str, enum.Enum):
    NEW = "new"
    CONTACTED = "contacted"
    SITE_VISIT = "site_visit"
    NEGOTIATION = "negotiation"
    CLOSED = "closed"
    LOST = "lost"


class UnitStatus(str, enum.Enum):
    AVAILABLE = "available"
    HOLD = "hold"
    SOLD = "sold"
    RENTED = "rented"


class ActivityType(str, enum.Enum):
    NOTE = "note"
    CALL = "call"
    FOLLOW_UP = "follow_up"
    BUILDER_SENT = "builder_sent"
    STATUS_CHANGE = "status_change"
    WHATSAPP = "whatsapp"


class ListingStatus(str, enum.Enum):
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    HOLD = "hold"
    SOLD = "sold"
    RENTED = "rented"


class MediaType(str, enum.Enum):
    IMAGE = "image"
    VIDEO = "video"
