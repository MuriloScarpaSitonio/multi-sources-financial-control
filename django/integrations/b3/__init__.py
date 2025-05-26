import asyncio
import ssl
from collections.abc import Generator
from pathlib import Path

import httpx

# https://developers.b3.com.br/index.php?option=com_content&view=article&id=26

BASE_URL = "https://apib3i-cert.b3.com.br:2443/api"
SCOPE = "0c991613-4c90-454d-8685-d466a47669cb/.default"

SECRETS_DIR = Path(__file__).resolve().parent / "secrets"


class TokenAuth(httpx.Auth):
    """Implements a token authentication scheme."""

    def __init__(self, token: str, token_label: str = "Bearer"):
        self.token = token
        self.token_label = token_label

    def auth_flow(self, request: httpx.Request) -> Generator[httpx.Request, httpx.Response, None]:
        request.headers["Authorization"] = f"{self.token_label} {self.token}"
        yield request


def get_client_credentials():
    # ajustar #######
    with open(SECRETS_DIR / "#######_client_id_secret.txt") as f:
        client_id_line, client_secret_line = f.read().strip().split("\n")
    return client_id_line.split(": ")[1], client_secret_line.split(": ")[1]


def get_certificate_password():
    # ajustar #######
    with open(SECRETS_DIR / "#######_senha_p12.txt") as f:
        return f.read().strip()


def get_ssl_context() -> ssl.SSLContext:
    ssl_context = ssl.create_default_context()
    ssl_context.load_cert_chain(
        # ajustar #######
        certfile=SECRETS_DIR / "#######.cer",
        # ajustar #######
        keyfile=SECRETS_DIR / "#######.key",
        password=get_certificate_password(),
    )
    return ssl_context


def get_b3_auth(ssl_context: ssl.SSLContext | None = None) -> TokenAuth:
    client_id, client_secret = get_client_credentials()

    response = httpx.post(
        "https://login.microsoftonline.com/4bee639f-5388-44c7-bbac-cb92a93911e6/oauth2/v2.0/token",
        data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
            "scope": SCOPE,
        },
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
        verify=ssl_context or get_ssl_context(),
        timeout=60.0,
    )
    data = response.json()
    return TokenAuth(token_label=data["token_type"], token=data["access_token"])


def get_async_client():
    ssl_context = get_ssl_context()
    return httpx.AsyncClient(
        auth=get_b3_auth(ssl_context),
        base_url=BASE_URL,
        verify=ssl_context,
        timeout=httpx.Timeout(connect=10, read=60, write=60, pool=120),
    )


async def runnner(product: str):
    client = get_async_client()
    response = await client.get(
        "/updated-product/v1/investors",
        params={
            "product": product,
            "referenceStartDate": "2020-01-01",
            "referenceEndDate": "2025-01-01",
        },
    )
    print(f"Request URL: {response.request.url}")
    print(f"Request     Headers: {dict(response.request.headers)}")
    print(f"Request Body: {response.request.content}")
    print()
    print(f"Response Status: {response.status_code}")
    print(f"Response Body: {response.text}")


def run(product: str = "FixedIncomeMovement"):
    asyncio.run(runnner(product))
