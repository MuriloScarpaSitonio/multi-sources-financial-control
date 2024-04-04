import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import { styled } from "@mui/styles";

const LoaderWrapper = styled(Container)({
  position: "absolute",
  top: 0,
  left: 0,
  zIndex: 1000,
  width: "100%",
  height: "100%",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  background: "rgba(255,255,255,0.8)",
});

export const Loader = ({ size = 48, color = "#666262" }) => (
  <LoaderWrapper>
    <CircularProgress size={size} style={{ color: color }} />
  </LoaderWrapper>
);
