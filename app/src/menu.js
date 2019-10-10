'use strict';

const electron = require('electron');
const { app, shell, Menu, autoUpdater, dialog, BrowserWindow } = electron;
const path = require('path');

const defaultMenu = require('electron-default-menu');

const env = require('./config/env.js');
const constants = require('./helpers/constants');
const fs = require('fs');

let preferencesWindow = null;

function setupMenu(webContents) {
	const menu = defaultMenu(app, shell);

	// Main menu
	let mainMenu = menu[0];
	mainMenu.submenu.splice(
		1,
		0,
		{
			type: 'separator',
		},
		{
			label: 'Messenger Preferences...',
			click() {
				webContents.send(constants.SHOW_MESSENGER_SETTINGS);
			},
		},
		{
			label: 'Preferences...',
			accelerator: 'CmdOrCtrl+,',
			click() {
				if (preferencesWindow != null) {
					return;
				}

				preferencesWindow = new BrowserWindow({ 
					width: 600, 
					height: 700,
					titleBarStyle: 'default', 
					title: 'Preferences', 
					webPreferences: {
						nodeIntegration: true,
					},
				});
			
				preferencesWindow.loadURL(`file://${path.join(__dirname, '/preferences/index.html')}`);
			
				preferencesWindow.once('ready-to-show', () => {
					preferencesWindow.show();
				});

				preferencesWindow.on('close', () => {
					preferencesWindow = null;
				});
			},
		}
	);

	if (env.name === 'production') {
		menu[0].submenu.splice(1, 0, {
			label: 'Check for Update',
			click() {
				autoUpdater.on('update-not-available', () => {
					autoUpdater.removeAllListeners('update-not-available');
					dialog.showMessageBox({
						message: 'No update available',
						detail: `${env.appName} ${app.getVersion()} is the latest version available.`,
						buttons: [ 'OK' ],
					});
				});
				autoUpdater.checkForUpdates();
			},
		});
	}

	// Fix incorrect accelerator for "Hide Others" (imported from defaultMenu())
	mainMenu.submenu[mainMenu.submenu.findIndex(item => item.label === 'Hide Others')].accelerator = 'Command+Option+H';

	// File menu
	menu.splice(menu.findIndex(item => item.label === 'Edit'), 0, {
		label: 'File',
		submenu: [
			{
				label: 'New Conversation',
				accelerator: 'CmdOrCtrl+N',
				click() {
					webContents.send(constants.NEW_CONVERSATION);
				},
			},
			{
				label: 'Dark Mode',
				accelerator: 'CmdOrCtrl+D',
				type: 'checkbox',
				checked: false,
				click() {
					console.log(menu[1].submenu[1].checked);
					if (!(menu[1].submenu[1].checked)) {
						webContents.insertCSS(fs.readFileSync(path.join(__dirname, '/assets/nightmode.css'), 'utf8'));
						menu[1].submenu[1].checked = true;
					}
					else {
						//webContents.executeJavaScript('document.styleSheets[6].disabled = !document.styleSheets[6].disabled;');
						webContents.reload()
						menu[1].submenu[1].checked = false;
					}
				},
			},
		],
	});
	menu[1].submenu.push(
		{
			type: 'separator',
		},
		{
			label: 'Logout',
			click() {
				logout(webContents);
			},
		}
	);

	// View menu
	let viewMenu = menu[menu.findIndex(item => item.label === 'View')];
	viewMenu.submenu.splice(
		0,
		0,
		{
			type: 'separator',
		},
		{
			label: 'Inbox',
			accelerator: 'CmdOrCtrl+1',
			click() {
				webContents.send(constants.SHOW_MESSAGE_LIST_INBOX);
			},
		},
		{
			label: 'Active contacts',
			accelerator: 'CmdOrCtrl+2',
			click() {
				webContents.send(constants.SHOW_MESSAGE_LIST_ACTIVE_CONTACTS);
			},
		},
		{
			label: 'Message requests',
			accelerator: 'CmdOrCtrl+3',
			click() {
				webContents.send(constants.SHOW_MESSAGE_LIST_MESSAGE_REQUESTS);
			},
		},
		{
			label: 'Archived threads',
			accelerator: 'CmdOrCtrl+4',
			click() {
				webContents.send(constants.SHOW_MESSAGE_LIST_ARCHIVED_THREADS);
			},
		},
		{
			type: 'separator',
		}
	);

	// Conversation menu
	menu.splice(menu.findIndex(item => item.label === 'Window'), 0, {
		label: 'Conversation',
		submenu: [
			{
				label: 'Mute',
				accelerator: 'CmdOrCtrl+shift+M',
				click() {
					webContents.send(constants.MUTE_CONVERSATION);
				},
			},
			{
				type: 'separator',
			},
			{
				label: 'Archive',
				accelerator: 'CmdOrCtrl+shift+A',
				click() {
					webContents.send(constants.ARCHIVE_CONVERSATION);
				},
			},
			{
				label: 'Delete',
				accelerator: 'CmdOrCtrl+shift+D',
				click() {
					webContents.send(constants.DELETE_CONVERSATION);
				},
			},
			{
				type: 'separator',
			},
			{
				label: 'Mark as Unread/Read',
				accelerator: 'CmdOrCtrl+shift+R',
				click() {
					webContents.send(constants.MARK_CONVERSATION_UNREAD);
				},
			},
			{
				label: 'Mark as Spam',
				click() {
					webContents.send(constants.MARK_CONVERSATION_SPAM);
				},
			},
			{
				label: 'Report Spam or Abuse',
				click() {
					webContents.send(constants.REPORT_CONVERSATION_SPAM_OR_ABUSE);
				},
			},
		],
	});

	// Window Menu
	let windowMenu = menu[menu.findIndex(item => item.label === 'Window')];
	windowMenu.submenu.push(
		{
			label: 'Select Next Conversation',
			accelerator: 'CmdOrCtrl+]',
			click() {
				webContents.send(constants.NEXT_CONVERSATION);
			},
		},
		{
			label: 'Select Previous Conversation',
			accelerator: 'CmdOrCtrl+[',
			click() {
				webContents.send(constants.PREV_CONVERSATION);
			},
		},
		{
			type: 'separator',
		}
	);

	// Help Menu
	let helpMenu = menu[menu.findIndex(item => item.label === 'Help')];
	helpMenu.submenu[helpMenu.submenu.findIndex(item => item.label === 'Learn More')].click = () => { 
		// Load goofy website
		shell.openExternal('https://www.goofyapp.com');
	};

	Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
}

function logout(webContents) {
	const c = webContents.session.cookies;
	c.get({}, (error, cookies) => {
		for (let i = cookies.length - 1; i >= 0; i--) {
			const { name, domain, path, secure } = cookies[i];
			const url = 'http' + (secure ? 's' : '') + '://' + domain + path;
			c.remove(url, name, () => {});
		}
	});

	// this waits for all cookies to be removed, it would be nicer to wait for all callbacks to be called
	setTimeout(
		() => {
			app.relaunch();
			app.exit(0);
		},
		500
	);
}

module.exports = setupMenu;
