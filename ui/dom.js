// The page elements the modules work with.

export const board = document.getElementById('board');
export const undoBtn = document.getElementById('undoBtn');
export const newBtn = document.getElementById('newBtn');
export const restartBtn = document.getElementById('restartBtn');
export const statusEl = document.getElementById('status');
export const winPanel = document.getElementById('winPanel');
export const winText = document.getElementById('winText');
export const newDealBtn = document.getElementById('newDealBtn');
export const sameDealBtn = document.getElementById('sameDealBtn');
export const quitBtn = document.getElementById('quitBtn');
export const quitGameBtn = document.getElementById('quitGameBtn');
export const confirmModal = document.getElementById('confirmModal');
export const confirmCard = document.getElementById('confirmCard');
export const confirmContinue = document.getElementById('confirmContinue');
export const confirmCancel = document.getElementById('confirmCancel');
export const ruleLine = document.getElementById('ruleLine');
export const highestSel = document.getElementById('highestSel');
export const columnsSel = document.getElementById('columnsSel');
export const drawSel = document.getElementById('drawSel');
export const autoFinishChk = document.getElementById('autoFinishChk');
export const settingsHint = document.getElementById('settingsHint');
export const recordEl = document.getElementById('record');
export const recordFrame = document.getElementById('recordFrame');
export const recordTitle = recordEl.querySelector('.record-title');
export const highestLabel = highestSel.previousElementSibling;   // the "High card" label text
export const stepsEl = document.getElementById('steps');
export const endGameBtn = document.getElementById('endGameBtn');
export const copyRecordBtn = document.getElementById('copyRecordBtn');

export const tableWrap = board.parentElement;
