import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";

export const DividerWithText = ({
  children,
  textAlign,
  container,
  ...props
}) => {
  let _children =
    typeof children === "string" ? (
      <Typography
        variant="h5"
        gutterBottom
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        {children}
      </Typography>
    ) : (
      children
    );
  let divider = (
    <Grid
      container
      alignItems="center"
      spacing={2}
      style={{ marginTop: "15px" }}
      {...props}
    >
      <Grid item xs={textAlign === "left" ? 1 : true}>
        <Divider />
      </Grid>
      <Grid item>{_children}</Grid>
      <Grid item xs={textAlign === "right" ? 1 : true}>
        <Divider />
      </Grid>
    </Grid>
  );
  return container ? <Container>{divider}</Container> : divider;
};
