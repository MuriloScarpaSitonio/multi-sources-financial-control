import { useState, type ReactNode } from "react";
import Collapse from "@mui/material/Collapse";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ExpandLess from "@mui/icons-material/ExpandLess";
import Button from "@mui/material/Button";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Stepper from "@mui/material/Stepper";

import {
  Colors,
  FontSizes,
  FontWeights,
  getColor,
  Text,
} from "../../../../design-system";
import { DATASET_LABELS } from "../fire/fireHistoricalDatasets";

type Series = keyof typeof DATASET_LABELS;

const SOURCE_LINKS: Partial<Record<Series, string>> = {
  IBOV: "https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-amplos/indice-ibovespa-ibovespa-estatisticas-historicas.htm",
  IFIX: "https://www.b3.com.br/pt_br/market-data-e-indices/indices/indices-de-segmentos-e-setoriais/indice-fundos-de-investimentos-imobiliarios-ifix-estatisticas-historicas.htm",
  CDI: "https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?hdOidSeriesSelecionadas=4391&method=consultarGraficoPorId",
  SPY: "https://www.ssga.com/library-content/products/fund-data/etfs/us/navhist-us-en-spy.xlsx",
  VWRL: "https://www.vanguard.co.uk/professional/product/etf/equity/9505/ftse-all-world-ucits-etf-distributing#prices-and-distribution",
  IMA_S:
    "https://data.anbima.com.br/indices/consulta/ima/resultados-diarios/ima-s",
  IRF_M_1:
    "https://data.anbima.com.br/indices/consulta/ima/resultados-diarios/irf-m-1",
  IRF_M_1_PLUS:
    "https://data.anbima.com.br/indices/consulta/ima/resultados-diarios/irf-m-1-mais",
  IMA_B_5:
    "https://data.anbima.com.br/indices/consulta/ima/resultados-diarios/ima-b-5",
  IMA_B_5_PLUS:
    "https://data.anbima.com.br/indices/consulta/ima/resultados-diarios/ima-b-5-mais",
  IMA_GERAL_EX_C:
    "https://data.anbima.com.br/indices/consulta/ima/resultados-diarios/ima-geral-ex-c",
};

const sourceLabel = (series: Series) =>
  SOURCE_LINKS[series] ? (
    <Link href={SOURCE_LINKS[series]} target="_blank" rel="noopener noreferrer">
      {DATASET_LABELS[series]}
    </Link>
  ) : (
    DATASET_LABELS[series]
  );

type Props = {
  idPrefix: string;
  title: string;
  description: ReactNode;
  portfolio: readonly {
    series: Series;
    weight: number;
    fallbackSeries?: Series | null;
  }[];
  steps: readonly string[];
  activeStep: number;
  onStepChange: (step: number) => void;
  children: ReactNode;
};

const WalkthroughFrame = ({
  idPrefix,
  title,
  description,
  portfolio,
  steps,
  activeStep,
  onStepChange,
  children,
}: Props) => {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const sourcesId = `${idPrefix}-walkthrough-sources`;

  return (
    <Stack gap={3}>
      <Stack gap={0.5}>
        <Text size={FontSizes.MEDIUM} weight={FontWeights.SEMI_BOLD}>
          {title}
        </Text>
        <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
          {description}
        </Text>
      </Stack>
      <Stack gap={1}>
        <Button
          variant="brand-text"
          size="small"
          sx={{ alignSelf: "flex-start" }}
          aria-expanded={sourcesExpanded}
          aria-controls={sourcesId}
          endIcon={sourcesExpanded ? <ExpandLess /> : <ExpandMore />}
          onClick={() => setSourcesExpanded((value) => !value)}
        >
          Fontes da simulação
        </Button>
        <Collapse in={sourcesExpanded} id={sourcesId}>
          <Stack gap={1}>
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              Históricos selecionados:{" "}
              {[...portfolio]
                .sort((a, b) => b.weight - a.weight)
                .map((slice, index) => (
                  <span key={`${slice.series}-${index}`}>
                    {index > 0 && " · "}
                    {(slice.weight * 100).toLocaleString("pt-BR", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                    % {sourceLabel(slice.series)}
                    {slice.fallbackSeries && (
                      <>
                        {" "}
                        (complementado por {sourceLabel(slice.fallbackSeries)})
                      </>
                    )}
                  </span>
                ))}
              .
            </Text>
            <Text size={FontSizes.EXTRA_SMALL} color={Colors.neutral400}>
              Inflação:{" "}
              <Link
                href="https://www3.bcb.gov.br/sgspub/consultarvalores/consultarValoresSeries.do?hdOidSeriesSelecionadas=433&method=consultarGraficoPorId"
                target="_blank"
                rel="noopener noreferrer"
              >
                IPCA (BCB SGS 433)
              </Link>
              .
            </Text>
          </Stack>
        </Collapse>
      </Stack>
      <Stepper activeStep={activeStep} alternativeLabel nonLinear>
        {steps.map((label, index) => (
          <Step key={label} active={activeStep === index}>
            <StepLabel
              role="button"
              tabIndex={0}
              onClick={() => onStepChange(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onStepChange(index);
                }
              }}
              sx={{ cursor: "pointer" }}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
      <Stack
        gap={2}
        sx={{
          p: 2,
          borderRadius: 1,
          border: "1px solid",
          borderColor: getColor(Colors.neutral400),
        }}
      >
        {children}
        <Stack direction="row" gap={1} sx={{ mt: 1 }}>
          <Button
            size="small"
            variant="outlined"
            disabled={activeStep === 0}
            onClick={() => onStepChange(Math.max(0, activeStep - 1))}
          >
            Voltar
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={activeStep === steps.length - 1}
            onClick={() =>
              onStepChange(Math.min(steps.length - 1, activeStep + 1))
            }
          >
            Próximo
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
};

export default WalkthroughFrame;
