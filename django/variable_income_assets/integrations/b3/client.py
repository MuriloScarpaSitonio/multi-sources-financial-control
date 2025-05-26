import asyncio
import random
import re
import ssl
from collections.abc import AsyncGenerator, Generator
from datetime import date
from pathlib import Path
from typing import Any

import httpx

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
    with open(SECRETS_DIR / "43103989000171_client_id_secret.txt") as f:
        client_id_line, client_secret_line = f.read().strip().split("\n")
    return client_id_line.split(": ")[1], client_secret_line.split(": ")[1]


def get_certificate_password():
    with open(SECRETS_DIR / "43103989000171_senha_p12.txt") as f:
        return f.read().strip()


def get_ssl_context() -> ssl.SSLContext:
    ssl_context = ssl.create_default_context()
    ssl_context.load_cert_chain(
        certfile=SECRETS_DIR / "43103989000171.cer",
        keyfile=SECRETS_DIR / "43103989000171.key",
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


class B3Client:
    """Client for B3 Investidor API"""

    def __init__(self):
        self._client = None

    async def __aenter__(self):
        self._client = await self._get_client()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self._client:
            await self._client.aclose()
            self._client = None

    async def _get_client(self):
        if not self._client:
            self._client = get_async_client()
        return self._client

    async def _refresh_client(self):
        await self._client.aclose()
        self._client = None
        return await self._get_client()

    async def _fetch_page_with_retry(self, url: str, retries: int = 0) -> dict[str, Any] | None:
        """Fetch a page with retry logic and exponential backoff."""

        MAX_RETRIES = 3
        try:
            if retries > 0:
                # Add jitter to avoid thundering herd problem
                backoff = (2**retries) + random.uniform(0, 1)
                await asyncio.sleep(backoff)

            response = await self._client.get(url)

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 401 and retries < MAX_RETRIES:
                # Authentication failure - try to get a new client
                print(
                    f"Authentication failed for {url}, "
                    f"refreshing session and retrying ({retries + 1}/{MAX_RETRIES})..."
                )
                self._client = await self._refresh_client()
                return await self._fetch_page_with_retry(url, retries + 1)
            elif response.status_code == 429 and retries < MAX_RETRIES:  # Rate limited
                print(f"Rate limited for {url}, retrying ({retries + 1}/{MAX_RETRIES})...")
                return await self._fetch_page_with_retry(url, retries + 1)
            elif response.status_code == 403 and retries < MAX_RETRIES:  # Rate limited
                print(f"Forbidden for {url}, retrying ({retries + 1}/{MAX_RETRIES})..")
                return await self._fetch_page_with_retry(url, retries + 1)

            print(f"Error fetching page {url}: {response.status_code} {response.text}")
            return None
        except httpx.TimeoutException as e:
            if retries < MAX_RETRIES:
                print(f"Timeout error on {url}, retrying ({retries + 1}/{MAX_RETRIES})...")
                return await self._fetch_page_with_retry(url, retries + 1)
            print(f"Error fetching page {url} after {MAX_RETRIES} retries: {repr(e)}")
            return None
        except Exception as e:
            print(f"Error fetching page {url}: {repr(e)}")
            return None

    async def _fetch_paginated_data(
        self, base_url: str, last_page: int, batch_size: int, document_number: str | None = None
    ) -> tuple[list[dict[str, Any]], int | None]:
        """
        Fetch all pages from a paginated API endpoint.

        Args:
            base_url: URL template with {page_num} placeholder
            last_page: The last page number to fetch
            batch_size: Number of concurrent requests per batch
            document_number: Optional document number for logging

        Returns:
            Tuple of (list of page results, first error page number or None if no errors)
        """
        doc_info = f"[Doc: {document_number}] " if document_number else ""

        # We already have page 1, so fetch pages 2 through last_page
        page_nums = list(range(2, last_page + 1))

        # Adjust batch size for large page counts to avoid connection pool exhaustion
        adjusted_batch_size = batch_size
        if last_page > 500:
            adjusted_batch_size = min(5, batch_size)  # Max 5 concurrent requests for huge datasets
        elif last_page > 100:
            adjusted_batch_size = min(
                10, batch_size
            )  # Max 10 concurrent requests for large datasets

        print(f"{doc_info}Fetching {last_page-1} pages in batches of {adjusted_batch_size}...")

        # Store all page results
        all_results = []
        fetched_count = 0
        success_count = 0
        first_error_page = None

        # Process pages in batches to avoid overwhelming the connection pool
        for i in range(0, len(page_nums), adjusted_batch_size):
            batch = page_nums[i : i + adjusted_batch_size]
            batch_urls = [base_url.format(page_num=page) for page in batch]

            # Remove the base URL if it's included in the page URLs
            if BASE_URL:
                batch_urls = [url.replace(BASE_URL, "") for url in batch_urls]

            batch_start = i + 2  # +2 because we're starting from page 2
            batch_end = min(batch_start + len(batch) - 1, last_page)
            print(f"{doc_info}Fetching batch of {len(batch)} pages ({batch_start}-{batch_end})...")

            # Gather results for this batch
            batch_results = await asyncio.gather(
                *[self._fetch_page_with_retry(url) for url in batch_urls]
            )

            # Check for errors and track the first error page
            for j, result in enumerate(batch_results):
                if result is None and first_error_page is None:
                    first_error_page = batch[j]
                    print(f"{doc_info}First error occurred at page {first_error_page}")
                    # Stop after the first error - don't process any more batches
                    break

            # Track statistics
            fetched_count += len(batch)
            batch_success = sum(1 for r in batch_results if r is not None)
            success_count += batch_success

            # Add results to our list
            all_results.extend(batch_results)

            print(f"{doc_info}Batch complete: {batch_success}/{len(batch)} successful requests")

            # Stop after the first error
            if first_error_page is not None:
                print(f"{doc_info}Stopping pagination after first error at page {first_error_page}")
                break

            # Small delay between batches to avoid overloading the server
            if i + adjusted_batch_size < len(page_nums):
                await asyncio.sleep(0.5)

        print(
            f"{doc_info}All batches complete: {success_count}/{len(page_nums)} successful requests"
        )

        if first_error_page:
            print(f"{doc_info}Encountered first error at page {first_error_page}")

        return all_results, first_error_page

    def _merge_array_results(
        self,
        original_data: dict[str, Any],
        page_results: list[dict[str, Any] | None],
        data_path: str,
        document_number: str | None = None,
    ) -> dict[str, Any]:
        """
        Merge paginated results into the original data structure.

        Args:
            original_data: The original data structure (first page)
            page_results: List of additional page results (may contain None for failed requests)
            data_path: Dot-notation path to the array that should be extended
            document_number: Optional document number for logging

        Returns:
            The merged data structure
        """
        doc_info = f"[Doc: {document_number}] " if document_number else ""

        # Parse the data path to find the target array
        path_parts = data_path.split(".")
        data_container = original_data

        # Navigate to the parent container of the target array
        for part in path_parts[:-1]:
            if part in data_container:
                data_container = data_container[part]
            else:
                print(f"{doc_info}Path part '{part}' not found in original data")
                return original_data

        # Get the name of the target array
        array_name = path_parts[-1]
        if array_name not in data_container:
            print(f"{doc_info}Target array '{array_name}' not found in original data")
            return original_data

        # Get the target array
        target_array = data_container[array_name]

        # Process each page result
        merged_count = 0

        for page_result in page_results:
            if page_result is None:
                continue

            # Navigate to the target array in this page
            page_container = page_result
            valid_page = True

            for part in path_parts[:-1]:
                if part in page_container:
                    page_container = page_container[part]
                else:
                    valid_page = False
                    break

            if not valid_page or array_name not in page_container:
                continue

            # Get the array from this page
            page_array = page_container[array_name]
            if not page_array:
                continue

            # Standard array extension
            target_array.extend(page_array)
            merged_count += len(page_array)

        print(f"{doc_info}Merged {merged_count} items into array")
        print(f"{doc_info}Final array length: {len(target_array)}")

        return original_data

    async def _fetch_all_pages(
        self,
        result: dict[str, Any],
        data_path: str,
        batch_size: int,
        document_number: str | None = None,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """
        Fetches all pages for a paginated B3 API response and combines the results.

        Args:
            result: The initial API response containing the first page
            data_path: Dot-notation path to the array that should be extended
            batch_size: Number of concurrent requests per batch
            document_number: Optional document number for logging purposes

        Returns:
            Tuple of (combined result with all successful pages, pagination info dict)
            The pagination info contains:
                - total_pages: Total number of pages in the API
                - last_fetched_page: Last page successfully fetched
                - first_error_page: First page where an error occurred (or None)
                - success_count: Number of pages successfully fetched
                - last_reference_date: Last reference date successfully processed (if available)
        """
        doc_info = f"[Doc: {document_number}] " if document_number else ""

        # Check if the response has pagination links
        if not result or "links" not in result:
            print(f"{doc_info}No pagination links found in response")
            return result, {
                "total_pages": 1,
                "last_fetched_page": 1,
                "first_error_page": None,
                "success_count": 1,
            }

        links = result.get("links", {})
        if "last" not in links or "self" not in links:
            print(f"{doc_info}Missing 'last' or 'self' pagination links")
            return result, {
                "total_pages": 1,
                "last_fetched_page": 1,
                "first_error_page": None,
                "success_count": 1,
            }

        # Extract the last page number
        last_url = links["last"]
        last_page_match = re.search(r"page=(\d+)", last_url)
        if not last_page_match:
            print(f"{doc_info}Could not determine last page number from: {last_url}")
            return result, {
                "total_pages": 1,
                "last_fetched_page": 1,
                "first_error_page": None,
                "success_count": 1,
            }

        last_page = int(last_page_match.group(1))
        total_pages = last_page

        if last_page <= 1:
            print(f"{doc_info}Only one page exists, no need to fetch more")
            return result, {
                "total_pages": 1,
                "last_fetched_page": 1,
                "first_error_page": None,
                "success_count": 1,
            }

        # Extract base URL template for pagination
        self_url = links["self"]
        if "page=" in self_url:
            base_url = re.sub(r"page=\d+", "page={page_num}", self_url)
        else:
            if "?" in self_url:
                base_url = self_url + "&page={page_num}"
            else:
                base_url = self_url + "?page={page_num}"

        print(f"{doc_info}Found {total_pages} pages total, will fetch pages 2 to {last_page}")

        # Step 1: Fetch all pages
        page_results, first_error_page = await self._fetch_paginated_data(
            base_url=base_url,
            last_page=last_page,
            batch_size=batch_size,
            document_number=document_number,
        )

        # Step 2: Merge the results
        merged_result = self._merge_array_results(
            original_data=result,
            page_results=page_results,
            data_path=data_path,
            document_number=document_number,
        )

        # Calculate the last successfully fetched page
        success_count = sum(1 for r in page_results if r is not None) + 1  # +1 for first page
        last_fetched_page = 1  # We always have page 1

        if page_results:
            # Find the last non-None result in the page_results list
            for i in range(len(page_results) - 1, -1, -1):
                if page_results[i] is not None:
                    # page_results starts at index 0 for page 2
                    last_fetched_page = i + 2
                    break

        # Extract the last reference date if possible
        last_reference_date = None

        # Build pagination info
        pagination_info = {
            "total_pages": total_pages,
            "last_fetched_page": last_fetched_page,
            "first_error_page": first_error_page,
            "success_count": success_count,
        }

        # Add last reference date if found
        if last_reference_date:
            pagination_info["last_reference_date"] = last_reference_date

        print(f"{doc_info}Pagination info: {pagination_info}")

        return merged_result, pagination_info

    async def check_investor_authorization(self, document_number: str) -> dict[str, Any]:
        """Check if investor has authorized data access"""
        client = await self._get_client()
        response = await client.get(
            f"/authorization-investor/v1/authorizations/investors/{document_number}"
        )
        response.raise_for_status()
        return response.json()

    async def get_updated_products(
        self,
        product: str,
        start_date: date,
        end_date: date,
        all_pages: bool = False,
    ) -> tuple[dict[str, Any], dict[str, Any] | None]:
        """
        Get updated products for a specific type with pagination support.

        Args:
            product: Product type to fetch
            start_date: Start date for the query
            end_date: End date for the query
            all_pages: Whether to fetch all pages (True) or just the first page (False)

        Returns:
            Tuple of (API result dict, pagination info dict or None if all_pages=False)
        """
        client = await self._get_client()

        # Initial request
        response = await client.get(
            "/updated-product/v1/investors",
            params={
                "product": product,
                "referenceStartDate": start_date.isoformat(),
                "referenceEndDate": end_date.isoformat(),
            },
        )

        # Handle 204 No Content response
        if response.status_code == 204:
            return {}, None

        # Raise for other error status codes
        response.raise_for_status()

        result = response.json()
        pagination_info = None

        # Handle pagination if requested
        if all_pages:
            result, pagination_info = await self._fetch_all_pages(
                result=result,
                data_path="data.updatedProducts",
                batch_size=200,
            )

        return result, pagination_info

    async def get_treasury_bond_movements(
        self, document_number: str, start_date: date, end_date: date
    ) -> dict[str, Any]:
        """Get treasury bond transactions"""
        client = await self._get_client()
        response = await client.get(
            f"/movement/v2/treasury-bonds/investors/{document_number}",
            params={
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
            },
        )
        response.raise_for_status()
        return response.json()

    async def get_fixed_income_movements(
        self, document_number: str, start_date: date, end_date: date
    ) -> dict[str, Any]:
        """Get fixed income transactions (CDBs, etc)"""
        client = await self._get_client()
        response = await client.get(
            f"/movement/v2/fixed-income/investors/{document_number}",
            params={
                "startDate": start_date.isoformat(),
                "endDate": end_date.isoformat(),
            },
        )
        response.raise_for_status()
        return response.json()

    async def get_variable_income_positions(
        self, document_number: str, reference_date: date | None = None
    ) -> dict[str, Any]:
        """Get variable income positions"""
        client = await self._get_client()
        params = {}
        if reference_date:
            params["referenceDate"] = reference_date.isoformat()

        response = await client.get(
            f"/position/v3/variable-income/investors/{document_number}", params=params
        )
        response.raise_for_status()
        return response.json()

    async def _stream_api_data_by_date(
        self,
        url: str,
        params: dict[str, str],
        data_path: str,
        nested_array_key: str,
        reference_key: str,
        batch_size: int = 40,
        document_number: str | None = None,
    ) -> AsyncGenerator[tuple[str, list[dict]], None]:
        """
        Generic helper method to stream API data grouped by date.

        Fetches paginated data from the B3 API and yields items grouped by a
        reference date as they become available.

        Args:
            url: API endpoint URL
            params: URL parameters for the request
            data_path: Dot-notation path to the array containing the data
            nested_array_key: Key for the nested array within each item
            reference_key: Key to use for grouping data
            batch_size: Number of concurrent requests per batch
            document_number: Optional document number for logging

        Yields:
            Tuple of (reference_date, list of items for this date)
        """
        client = await self._get_client()
        doc_info = f"[Doc: {document_number}] " if document_number else ""

        # Get the first page to determine total pages
        response = await client.get(url, params=params)
        response.raise_for_status()
        result = response.json()

        # Initialize a dict to collect data by date
        data_by_date = {}

        # Process the first page - navigate to the data container
        path_parts = data_path.split(".")
        data_container = result
        for part in path_parts:
            if part in data_container:
                data_container = data_container[part]
            else:
                print(f"{doc_info}Path part '{part}' not found in data")
                return

        # Process each item in the first page
        if isinstance(data_container, list):
            for item in data_container:
                ref_date = item.get(reference_key)
                if ref_date and nested_array_key in item and item[nested_array_key]:
                    if ref_date not in data_by_date:
                        data_by_date[ref_date] = []
                    data_by_date[ref_date].extend(item[nested_array_key])

        # Yield data from the first page
        for ref_date in sorted(data_by_date.keys()):
            yield ref_date, data_by_date[ref_date]
            # Clear the data we just yielded to free memory
            del data_by_date[ref_date]

        # Check if we need to fetch more pages
        if "links" not in result or "last" not in result["links"] or "self" not in result["links"]:
            return

        # Extract the last page number
        last_url = result["links"]["last"]
        last_page_match = re.search(r"page=(\d+)", last_url)
        if not last_page_match:
            return

        last_page = int(last_page_match.group(1))
        if last_page <= 1:
            return

        # Extract base URL template for pagination
        self_url = result["links"]["self"]
        if "page=" in self_url:
            base_url = re.sub(r"page=\d+", "page={page_num}", self_url)
        else:
            if "?" in self_url:
                base_url = self_url + "&page={page_num}"
            else:
                base_url = self_url + "?page={page_num}"

        print(f"{doc_info}Found {last_page} pages total, streaming pages 2 to {last_page}")

        # We already have page 1, so fetch pages 2 through last_page
        page_nums = list(range(2, last_page + 1))

        # Adjust batch size for large page counts
        adjusted_batch_size = batch_size
        if last_page > 500:
            adjusted_batch_size = min(5, batch_size)
        elif last_page > 100:
            adjusted_batch_size = min(10, batch_size)

        # Process pages in batches
        for i in range(0, len(page_nums), adjusted_batch_size):
            batch = page_nums[i : i + adjusted_batch_size]
            batch_urls = [base_url.format(page_num=page) for page in batch]

            # Remove the base URL if it's included in the page URLs
            if BASE_URL:
                batch_urls = [url.replace(BASE_URL, "") for url in batch_urls]

            batch_start = i + 2  # +2 because we're starting from page 2
            batch_end = min(batch_start + len(batch) - 1, last_page)
            print(f"{doc_info}Fetching batch of {len(batch)} pages ({batch_start}-{batch_end})...")

            # Gather results for this batch
            batch_results = await asyncio.gather(
                *[self._fetch_page_with_retry(url) for url in batch_urls]
            )

            # Process each page result
            has_error = False
            for batch_result in batch_results:
                if batch_result is None:
                    has_error = True
                    break

                # Navigate to the data container for this page
                page_container = batch_result
                valid_page = True
                for part in path_parts:
                    if part in page_container:
                        page_container = page_container[part]
                    else:
                        valid_page = False
                        break

                if not valid_page or not isinstance(page_container, list):
                    continue

                # Extract and group data by date
                for item in page_container:
                    ref_date = item.get(reference_key)
                    if ref_date and nested_array_key in item and item[nested_array_key]:
                        if ref_date not in data_by_date:
                            data_by_date[ref_date] = []
                        data_by_date[ref_date].extend(item[nested_array_key])

            # Yield data from this batch, sorted by date
            for ref_date in sorted(data_by_date.keys()):
                yield ref_date, data_by_date[ref_date]
                # Clear the data we just yielded
                del data_by_date[ref_date]

            # Stop if we encountered an error
            if has_error:
                print(f"{doc_info}Stopping stream due to API error")
                break

            # Small delay between batches
            if i + adjusted_batch_size < len(page_nums):
                await asyncio.sleep(0.5)

    async def stream_assets_trading(
        self,
        document_number: str,
        start_date: date,
        end_date: date,
        batch_size: int = 40,
    ) -> AsyncGenerator[tuple[str, list[dict]], None]:
        """
        Stream assets trading data for an investor, yielding data by date as it's fetched.

        This generator fetches pages of data from the B3 API and yields each date's
        trading data as soon as it's available, without waiting for the entire API fetch
        to complete. This allows for processing data while the fetch continues.

        Each yield is a tuple of (reference_date, asset_trading_list) where the
        asset_trading_list contains all trading data for that date across all pages.

        Args:
            document_number: Investor document number
            start_date: Start date for the query
            end_date: End date for the query
            batch_size: Number of concurrent requests per batch

        Yields:
            Tuple of (reference_date, list of trading items for this date)

        Raises:
            httpx.HTTPStatusError: If the API request fails
        """
        # Configure the API request
        url = f"/assets-trading/v2/investors/{document_number}"
        params = {
            "referenceStartDate": start_date.isoformat(),
            "referenceEndDate": end_date.isoformat(),
        }

        # Stream data using the generic helper
        async for date_and_items in self._stream_api_data_by_date(
            url=url,
            params=params,
            data_path="data.periods.periodLists",
            nested_array_key="assetTradingList",
            reference_key="referenceDate",
            batch_size=batch_size,
            document_number=document_number,
        ):
            yield date_and_items

    async def stream_equities_movements(
        self,
        document_number: str,
        start_date: date,
        end_date: date,
        batch_size: int = 20,
        page_size: int = 100,
    ) -> AsyncGenerator[tuple[str, list[dict]], None]:
        """
        Stream equities movements data for an investor, yielding data by date as it's fetched.

        This generator fetches pages of data from the B3 API and yields each date's
        movement data as soon as it's available, without waiting for the entire API fetch
        to complete. This allows for processing data while the fetch continues.

        Each yield is a tuple of (reference_date, movements_list) where the
        movements_list contains all movement data for that date across all pages.

        Args:
            document_number: Investor document number
            start_date: Start date for the query
            end_date: End date for the query
            batch_size: Number of concurrent requests per batch
            page_size: Number of items per page in the API request

        Yields:
            Tuple of (reference_date, list of movement items for this date)

        Raises:
            httpx.HTTPStatusError: If the API request fails
        """
        # Configure the API request
        url = f"/movement/v2/equities/investors/{document_number}"
        params = {
            "referenceStartDate": start_date.isoformat(),
            "referenceEndDate": end_date.isoformat(),
            "page-size": str(page_size),
        }

        # Stream data using the generic helper
        async for date_and_items in self._stream_api_data_by_date(
            url=url,
            params=params,
            data_path="data.equitiesPeriods.equitiesMovements",
            nested_array_key="equitiesMovementsList",
            reference_key="referenceDate",
            batch_size=batch_size,
            document_number=document_number,
        ):
            yield date_and_items
