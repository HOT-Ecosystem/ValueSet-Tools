// from https://mui.com/material-ui/react-app-bar/#ResponsiveAppBar.js
import MenuIcon from "@mui/icons-material/Menu";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Snackbar from '@mui/material/Snackbar';
import Menu from "@mui/material/Menu";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import React, {useEffect, useState} from "react";
import MenuBookRounded from "@mui/icons-material/MenuBookRounded";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import { NavLink, useLocation } from "react-router-dom";
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

// import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
// import ChevronRightIcon from "@mui/icons-material/ChevronRight";
// import CssBaseline from "@mui/material/CssBaseline";
// import Divider from "@mui/material/Divider";
// import Drawer from "@mui/material/Drawer";
// import List from "@mui/material/List";
// import ListItem from "@mui/material/ListItem";
// import ListItemButton from "@mui/material/ListItemButton";
// import { styled, useTheme } from "@mui/material/styles";
// import ListItemText from "@mui/material/ListItemText";
import { cloneDeep } from "lodash";
import {VERSION, DEPLOYMENT} from "../env";
import {urlWithSessionStorage, useCodesetIds, useCids, } from '../state/AppState';
// import {client} from "./utils";

const drawerWidth = 240;

let _pages = [
  { name: "Load value sets", href: "/OMOPConceptSets" },
  { name: "Analyze and author", href: "/cset-comparison" },
  { name: "Add concepts", href: "/add-concepts" },
  // { name: "Graph", href: "/graph" },
  // {name: 'Upload CSV', href: '/upload-csv', noSearch: true, },
  // TODO: re-add Download (CSets, bundles, json...) at some point
  //{name: 'Download CSet JSON', href: '/download-json', noSearch: true, },
  { name: "Help / About", href: "/about" },
];
if (DEPLOYMENT === 'local') {
  _pages.push(
      { name: "Graph", href: "/graph" },
      );
}
export function getPages(codeset_ids, cids) {
  let pages = cloneDeep(_pages);
  // if there are no codesets, disable the comparison page
  if (!codeset_ids.length && !cids.length) {
    let page = pages.find((d) => d.href == "/cset-comparison");
    page.disable = true;
    page.tt =
        "Select one or more concept sets in order to view, compare, or edit them.";
  }
  return pages;
}
// const settings = ['About'];

/* https://mui.com/material-ui/react-app-bar/ */
export default function MuiAppBar() {
  const [codeset_ids, ] = useCodesetIds();
  const [cids, ] = useCids();
  const [copiedUrlSize, setCopiedUrlSize] = useState(undefined);

  const location = useLocation();
  const { search } = location;
  const pages = getPages(codeset_ids, cids);

  const [anchorElNav, setAnchorElNav] = React.useState(null);
  const [anchorElUser, setAnchorElUser] = React.useState(null);

  const handleOpenNavMenu = (event) => {
    setAnchorElNav(event.currentTarget);
    console.log(anchorElNav);
  };
  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
    console.log(anchorElUser);
  };
  const handleCloseNavMenu = () => {
    setAnchorElNav(null);
  };
  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };
  let hamburgerMenu = (
    <Box sx={{ flexGrow: 1, display: { xs: "flex", md: "none" } }}>
      <IconButton
        size="large"
        aria-label="account of current user"
        aria-controls="menu-appbar"
        aria-haspopup="true"
        onClick={handleOpenNavMenu}
        color="inherit"
      >
        <MenuIcon />
      </IconButton>
      <Menu
        /* This menu appears as a hamburger dropdown when the page is too narrow for the
                horizontal menu items */
        id="menu-appbar"
        anchorEl={anchorElNav}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        keepMounted
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        open={Boolean(anchorElNav)}
        onClose={handleCloseNavMenu}
        sx={{
          display: { xs: "block", md: "none" },
        }}
      >
        {pages.map((page) => (
          <MenuItem
            key={page.name}
            component={NavLink}
            to={`${page.href}${page.noSearch ? "" : search}`}
            onClick={handleCloseNavMenu}
          >
            <Typography textAlign="center">{page.name}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
  let horizontalMenu = (
    <Box /* This is the main, horizontal menu */
      sx={{ flexGrow: 1, display: { xs: "none", md: "flex" } }}
    >
      {pages.map((page) => {
        let button = (
          <Button
            data-testid={page.name}
            disabled={page.disable}
            key={page.name}
            // selected={page.href === window.location.pathname}
            component={NavLink} // NavLink is supposed to show different if it's active; doesn't seem to be working
            variant={
              page.href === window.location.pathname ? "contained" : "text"
            } // so, this instead
            to={`${page.href}${page.noSearch ? "" : search}`}
            onClick={handleCloseNavMenu}
            sx={{ my: 2, color: "white", display: "block" }}
          >
            {page.name}
          </Button>
        );
        if (page.tt) {
          button = (
            <Tooltip title={page.tt} key={page.name}>
              <div>{button}</div>
            </Tooltip>
          );
        }
        return button;
      })}
    </Box>
  );
  const handleCopyAppStateToClipboard = async () => {
    try {
      const url = urlWithSessionStorage();
      await navigator.clipboard.writeText(url);
      setCopiedUrlSize(url.length);
      console.log(`copied url ${url.length} characters`);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <AppBar
      className="Mui-app-bar"
      position="static"
      sx={{ backgroundColor: "#1986d2" }}
    >
      <Container maxWidth="false" /* "xl" */>
        <Toolbar disableGutters>
          <MenuBookRounded sx={{ display: { xs: "none", md: "flex" }, mr: 1 }} />
          <Typography
            data-testid="app-name"
            variant="h6"
            noWrap
            component="a"
            href="/"
            sx={{
              mr: 2,
              display: { xs: "none", md: "flex" },
              fontWeight: 700,
              letterSpacing: ".3rem",
              color: "inherit",
              textDecoration: "none",
              marginRight: "4px",
            }}
          >
            VS-Hub
          </Typography>
          <Typography
            data-testid="app-version"
            sx={{
              mr: 2,
              fontWeight: 700,
              color: "inherit",
            }}
          >
            v{ VERSION } {/*process.env.COMMIT_HASH*/}
          </Typography>
          <IconButton
              onClick={handleCopyAppStateToClipboard}
              title="Copy link to current application state to clipboard"
          >
            <ContentCopyIcon sx={{ color: 'white', display: { xs: "none", md: "flex" }, mr: 1 }} />
          </IconButton>

          <Snackbar
              open={typeof(copiedUrlSize) !== 'undefined'}
              autoHideDuration={copiedUrlSize <= 2000 ? 2000 : 8000}
              onClose={() => setCopiedUrlSize(undefined)}
              message={
                copiedUrlSize <= 2000
                  ? "Link copied to clipboard"
                  : `Copied URL is ${copiedUrlSize} characters long, which may be too long for pasting into a browser`
              }
          />

          {hamburgerMenu}

          <MenuBookRounded sx={{ display: { xs: "flex", md: "none" }, mr: 1 }} />
          <Typography
            variant="h5"
            noWrap
            component="a"
            href=""
            sx={{
              mr: 2,
              display: { xs: "flex", md: "none" },
              flexGrow: 1,
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: ".3rem",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            VS-Hub
          </Typography>

          {horizontalMenu}

          {/*
          <Box sx={{ flexGrow: 0 }}>
            <Tooltip title="Open settings">
              <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                <Avatar alt="VS-Hub" src="/static/images/termhubIcon.jpg" />
              </IconButton>
            </Tooltip>
            <Menu
              sx={{ mt: '45px' }}
              id="menu-user" /*"menu-appbar"* /
              anchorEl={anchorElUser}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'right',
              }}
              open={Boolean(anchorElUser)}
              onClose={handleCloseUserMenu}
            >
              {settings.map((setting) => (
                <MenuItem key={setting} onClick={handleCloseUserMenu}>
                  <Typography textAlign="center">{setting}</Typography>
                </MenuItem>
              ))}
            </Menu>
          </Box>
          */}
        </Toolbar>
      </Container>
    </AppBar>
  );
}
// export default MuiAppBar;

/*

const Main = styled("main", { shouldForwardProp: (prop) => prop !== "open" })(
  ({ theme, open }) => ({
    flexGrow: 1,
    padding: theme.spacing(3),
    transition: theme.transitions.create("margin", {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen,
    }),
    marginLeft: `-${drawerWidth}px`,
    ...(open && {
      transition: theme.transitions.create("margin", {
        easing: theme.transitions.easing.easeOut,
        duration: theme.transitions.duration.enteringScreen,
      }),
      marginLeft: 0,
    }),
  })
);

const AppBarForDrawer = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme, open }) => ({
  transition: theme.transitions.create(["margin", "width"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: `${drawerWidth}px`,
    transition: theme.transitions.create(["margin", "width"], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: "flex-end",
}));
 */