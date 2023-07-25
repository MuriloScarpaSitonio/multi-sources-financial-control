from locust import HttpUser, events, task


@events.init_command_line_parser.add_listener
def _(parser):
    parser.add_argument("--username", type=str, env_var="LOCUST_USERNAME")
    parser.add_argument("--password", type=str, env_var="LOCUST_PASSWORD")


class QuickstartUser(HttpUser):
    @task
    def full_assets_list(self):
        self.client.get("/assets?page_size=100")

    def on_start(self):
        r = self.client.post(
            "/token",
            json={
                "username": self.environment.parsed_options.username,
                "password": self.environment.parsed_options.password,
            },
        )
        self.client.headers = {"Authorization": f"Bearer {r.json()['access']}"}
