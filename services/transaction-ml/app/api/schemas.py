from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CustomerFeatures(BaseModel):
    avgAmount30d: Annotated[float | None, Field(gt=0, allow_inf_nan=False)] = None
    txCount24h: Annotated[int, Field(ge=0, le=1_000_000)] = 0


class TransactionInput(BaseModel):
    model_config = ConfigDict(extra="ignore")
    transactionId: Annotated[str | None, Field(max_length=128)] = None
    externalCustomerId: Annotated[str | None, Field(max_length=128)] = None
    amount: Annotated[Decimal, Field(gt=0, le=Decimal("1000000000000"), max_digits=17, decimal_places=4)]
    currency: Annotated[str, Field(pattern=r"^[A-Z]{3}$")] = "GMD"
    timestamp: datetime
    channel: Annotated[str, Field(min_length=1, max_length=64)] = "api"
    location: Annotated[str | None, Field(max_length=128)] = None
    counterparty: Annotated[str | None, Field(max_length=256)] = None
    customerFeatures: CustomerFeatures = Field(default_factory=CustomerFeatures)

    @field_validator("timestamp")
    @classmethod
    def timezone_required(cls, value: datetime) -> datetime:
        if value.utcoffset() is None:
            raise ValueError("timestamp requires a timezone")
        return value


class ScoreRequest(BaseModel):
    transactions: Annotated[list[TransactionInput], Field(min_length=1, max_length=100)]
