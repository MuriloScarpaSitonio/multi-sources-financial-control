from ..settings import AGILIZE_URL


def post(data: dict) -> None:  # pragma: no cover
    print(f"Sending POST request to `{AGILIZE_URL}`. Data: {data}")
