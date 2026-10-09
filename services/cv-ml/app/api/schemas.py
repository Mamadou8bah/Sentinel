from typing import Annotated

from pydantic import BaseModel, Field

EncodedImage = Annotated[str, Field(min_length=1, max_length=4_000_100)]


class LivenessRequest(BaseModel):
    challengeId: Annotated[str, Field(min_length=1, max_length=64)]
    frames: Annotated[list[EncodedImage], Field(min_length=3, max_length=12)]


class KycRequest(BaseModel):
    idImage: EncodedImage
    selfieImage: EncodedImage
    challengeId: Annotated[str | None, Field(max_length=64)] = None
    frames: Annotated[list[EncodedImage] | None, Field(min_length=3, max_length=12)] = None
