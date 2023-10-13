import { useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";

import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Tab from "@material-ui/core/Tab";
import Tabs from "@material-ui/core/Tabs";
import Typography from "@material-ui/core/Typography";

import { makeStyles } from "@material-ui/core/styles";

import { IntegrationsConfiguration } from "../components/user/IntegrationsConfiguration";
import { ManageStripe } from "../components/user/ManageStripe";
import { UserData } from "../components/user/UserData";
import { UserApi } from "../api";
import { stringToBoolean, setUserDataToLocalStorage } from "../helpers.js";

const useStyles = makeStyles((theme) => ({
  tabs: {
    borderRight: `1px solid ${theme.palette.divider}`,
  },
}));

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`vertical-tabpanel-${index}`}
      aria-labelledby={`vertical-tab-${index}`}
      {...other}
      style={{ position: "relative" }}
    >
      {value === index && (
        <Box p={3}>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  );
}

function getTabProps(index) {
  return {
    id: `vertical-tab-${index}`,
    "aria-controls": `vertical-tabpanel-${index}`,
  };
}
function useQueryParams() {
  const { search } = useLocation();

  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function User() {
  let queryParams = useQueryParams();

  const [tabValue, setTabValue] = useState(
    parseInt(queryParams.get("tab")) || 0
  );
  const history = useHistory();

  useEffect(() => {
    if (queryParams.get("refresh")) {
      queryParams.delete("refresh");
      console.log(queryParams.toString());
      new UserApi(localStorage.getItem("user_id"))
        .retrieve()
        .then((response) => {
          setUserDataToLocalStorage(response.data);
        })
        .finally(() =>
          history.push(history.replace({ search: queryParams.toString() }))
        );
    }
  });

  const classes = useStyles();
  const isInvestmentsIntegrationsModuleEnabled = stringToBoolean(
    localStorage.getItem("user_is_investments_integrations_module_enabled")
  );
  const isSubscriptionCancelled =
    localStorage.getItem("user_subscription_status") === "CANCELED";

  return (
    <Grid container style={{ marginTop: "15px" }}>
      <Tabs
        orientation="vertical"
        variant="scrollable"
        value={tabValue}
        onChange={(_, v) => setTabValue(v)}
        className={classes.tabs}
      >
        <Tab label="Minha conta" {...getTabProps(0)} />
        {!isSubscriptionCancelled && (
          <Tab label="Meu plano" {...getTabProps(1)} />
        )}
        {isInvestmentsIntegrationsModuleEnabled && (
          <Tab label="Integrações" {...getTabProps(2)} />
        )}
      </Tabs>

      <TabPanel value={tabValue} index={0}>
        <UserData
          initialData={{
            userId: localStorage.getItem("user_id"),
            username: localStorage.getItem("user_username"),
            email: localStorage.getItem("user_email"),
          }}
        />
      </TabPanel>
      {!isSubscriptionCancelled && (
        <TabPanel value={tabValue} index={1}>
          <ManageStripe />
        </TabPanel>
      )}
      {isInvestmentsIntegrationsModuleEnabled && (
        <TabPanel value={tabValue} index={2}>
          <IntegrationsConfiguration userId={localStorage.getItem("user_id")} />
        </TabPanel>
      )}
    </Grid>
  );
}
