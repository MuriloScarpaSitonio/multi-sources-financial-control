import Snackbar from '@material-ui/core/Snackbar';
import MuiAlert from '@material-ui/lab/Alert';

export const FormFeedback = ({ open, onClose, message, severity = "error" }) => {
    return (
        <Snackbar open={open} autoHideDuration={5000} onClose={onClose}>
            <MuiAlert elevation={6} variant="filled" onClose={onClose} severity={severity}>
                {message}
            </MuiAlert>
        </Snackbar>
    )
}
