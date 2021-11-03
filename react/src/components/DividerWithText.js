import Container from "@material-ui/core/Container";
import Divider from "@material-ui/core/Divider";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";

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
