import { useState, useEffect } from "react";

import { useHistory } from "react-router-dom";

import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import FormGroup from "@material-ui/core/FormGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Grid from "@material-ui/core/Grid";
import Switch from "@material-ui/core/Switch";
import Typography from "@material-ui/core/Typography";

import { SubscriptionApi } from "../api";

// TODO refactor -> it's more complex than it should
export default function Subscription() {
  const [isLoaded, setIsLoaded] = useState(true);
  const [isPriceLoaded, setIsPriceLoaded] = useState(false);

  const [switchesState, setSwitchesState] = useState({
    investments: true,
    finances: true,
    investmentsIntegrations: true,
    modules: "investments_integrations_finances",
  });
  const [products, setProducts] = useState({
    investments: {
      price_id: "",
      amount: 0,
      description: "",
    },
    finances: {
      price_id: "",
      amount: 0,
      description: "",
    },
    investments_finances: {
      price_id: "",
      amount: 0,
      description: "",
    },
    investments_integrations: {
      price_id: "",
      amount: 0,
      description: "",
    },
    investments_integrations_finances: {
      price_id: "",
      amount: 0,
      description: "",
    },
  });

  const history = useHistory();
  const api = new SubscriptionApi();

  useEffect(() => {
    if (localStorage.getItem("user_subscription_status") !== "CANCELED") {
      history.goBack();
    }
    api
      .getProducts()
      .then((response) => setProducts(response.data.products))
      .finally(() => setIsPriceLoaded(true));
  }, [history]);

  const handleSubmit = () => {
    setIsLoaded(false);
    api
      .createCheckoutSession(products[switchesState.modules].price_id)
      .then((response) => window.location.replace(response.data.url))
      .catch((error) => console.log(error));
  };

  const handleSwitchesChange = (event) => {
    const newState = {
      ...switchesState,
      [event.target.name]: event.target.checked,
    };
    setSwitchesState({
      ...newState,
      modules: getModules(
        newState.investments,
        newState.investmentsIntegrations,
        newState.finances
      ),
    });
  };

  function getModules(
    isInvestmentsSelected,
    isInvestmentsIntegrationsSelected,
    isFinancesSelected
  ) {
    // this is terrible, I know............................
    if (isInvestmentsSelected) {
      if (isFinancesSelected) {
        if (isInvestmentsIntegrationsSelected) {
          return "investments_integrations_finances";
        } else {
          return "investments_finances";
        }
      } else if (isInvestmentsIntegrationsSelected) {
        return "investments_integrations";
      } else {
        return "investments";
      }
    } else {
      return "finances";
    }
  }

  return (
    <div style={{ textAlign: "center" }}>
      <Typography component="h1" variant="h4" style={{ marginBottom: "50px" }}>
        Selecione as funcionalidades
      </Typography>
      <Grid container style={{ flexGrow: 1 }} spacing={5}>
        <Grid item>
          <FormGroup row>
            <FormControlLabel
              control={
                <Switch
                  checked={switchesState.finances}
                  onChange={handleSwitchesChange}
                  name="finances"
                  color="primary"
                />
              }
              label="Finanças pessoais"
              labelPlacement="top"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={switchesState.investments}
                  onChange={handleSwitchesChange}
                  name="investments"
                  color="primary"
                />
              }
              label="Investimentos"
              labelPlacement="top"
            />
            {switchesState.investments && (
              <FormControlLabel
                value="start"
                control={
                  <Switch
                    checked={switchesState.investmentsIntegrations}
                    onChange={handleSwitchesChange}
                    name="investmentsIntegrations"
                    color="primary"
                  />
                }
                label="Integraçōes"
                labelPlacement="top"
              />
            )}
          </FormGroup>
        </Grid>
        <Grid item>
          <Typography variant="h3" align="center" color="text.primary">
            {!isPriceLoaded ? (
              <span>
                R$ <CircularProgress size={24} />
              </span>
            ) : (
              `R$ ${products[switchesState.modules].amount}`
            )}
          </Typography>
        </Grid>
        <Grid item>
          <Button
            onClick={handleSubmit}
            color="primary"
            variant={isLoaded && "contained"}
            disabled={!switchesState.finances && !switchesState.investments}
            size="large"
          >
            {!isLoaded ? <CircularProgress size={28} /> : "Assinar"}
          </Button>
        </Grid>
      </Grid>
    </div>
  );
}
