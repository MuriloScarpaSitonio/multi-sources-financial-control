import CircularProgress from '@material-ui/core/CircularProgress';
import Container from '@material-ui/core/Container';
import { styled } from '@material-ui/core/styles';

const TableLoaderWrapper = styled(Container)({
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1000,
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.8)'
})

export const TableLoader = ({ size = 48, color = '#666262' }) => {
    return (
        <TableLoaderWrapper>
            <CircularProgress size={size} style={{ color: color }} />
        </TableLoaderWrapper>
    )
}
