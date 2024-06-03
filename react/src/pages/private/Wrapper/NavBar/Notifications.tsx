import {
  // useCallback, useEffect, useRef,
  useState,
} from "react";

import Badge from "@mui/material/Badge";
import IconButton from "@mui/material/IconButton";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

import NotificationsIcon from "@mui/icons-material/Notifications";

// import { getDateDiffString } from "../../../../helpers";
// import { TasksApi } from "../../../../api";
// import { useInfiniteQuery } from "@tanstack/react-query";

// const PAGE_SIZE = 10;

const Notifications = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  //   const [totalTasksUnnotified, setTotalTasksUnnotified] = useState(0);
  //   const [page, setPage] = useState(1);

  //   const {
  //     data,
  //     error,
  //     fetchNextPage,
  //     hasNextPage,
  //     isFetching,
  //     isFetchingNextPage,
  //     status,
  //   } = useInfiniteQuery({
  //     queryKey: ['notifications'],
  //     queryFn: fetchProjects,
  //     initialPageParam: 1,
  //     getNextPageParam: (lastPage, pages) => lastPage.nextCursor,
  //   })
  const menuId = "navbar-menu";
  //   const observer = useRef();

  //   const [data, isLoaded, hasMore] = api.infiniteScroll(
  //     new URLSearchParams({
  //       page_size: PAGE_SIZE.toString(),
  //       page: page.toString(),
  //     }).toString(),
  //   );

  //   const lastTaskRef = useCallback(
  //     (node) => {
  //       if (!isLoaded) return;
  //       if (observer.current) observer.current.disconnect();
  //       observer.current = new IntersectionObserver((entries) => {
  //         if (entries[0].isIntersecting && hasMore) {
  //           setPage((prevPage) => prevPage + 1);
  //         }
  //       });
  //       if (node) observer.current.observe(node);
  //     },
  //     [isLoaded, hasMore],
  //   );

  //   const bulkUpdateNotifiedAt = (tasks) => {
  //     let tasksIds = tasks
  //       .filter((task) => new Date(task.updated_at) > new Date(task.notified_at))
  //       .map((task) => task.id);
  //     if (tasksIds.length > 0) {
  //       api.bulkUpdateNotifiedAt(tasksIds).then(() => getTotalTasksUnnotified());
  //     }
  //   };

  //   const getTotalTasksUnnotified = () => {
  //     api.count({ notified: false }).then((response) => {
  //       setTotalTasksUnnotified(response.data.total);
  //     });
  //   };
  //   useEffect(() => getTotalTasksUnnotified(), []);

  //   useEffect(() => {
  //     if (anchorEl !== null) bulkUpdateNotifiedAt(data);
  //   }, [data]);

  //   const handleClick = (e) => {
  //     setAnchorEl(e.currentTarget);
  //     bulkUpdateNotifiedAt(data);
  //   };

  //   let now = new Date();
  return (
    <>
      <IconButton
        size="large"
        color="inherit"
        aria-controls={menuId}
        onClick={(e) => setAnchorEl(e.currentTarget as unknown as null)}
      >
        <Badge badgeContent={0} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        id={menuId}
        keepMounted
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {/* {data.map((task, index) => (
          <>
            <MenuItem
              onClick={() => setAnchorEl(null)}
              ref={data.length === index + 1 ? lastTaskRef : undefined}
              divider
            >
              <ListItemText
                primary={task.notification_display_title}
                secondary={task.notification_display_text}
              />
              <p style={{ fontSize: "11px" }}>
                há ± {getDateDiffString(new Date(task.updated_at), now)}
              </p>
            </MenuItem>
          </>
        ))} */}
        <MenuItem>
          <ListItemText
            secondary="Não há mais notificações para carregar"
            secondaryTypographyProps={{ align: "center" }}
          />
        </MenuItem>
      </Menu>
    </>
  );
};

export default Notifications;
