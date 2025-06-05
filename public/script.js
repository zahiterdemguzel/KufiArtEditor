// Helper for point operations
class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(other) {
        return new Point(this.x + other.x, this.y + other.y);
    }

    subtract(other) {
        return new Point(this.x - other.x, this.y - other.y);
    }

    scale(factor) {
        return new Point(this.x * factor, this.y * factor);
    }

    distanceTo(other) {
        return Math.hypot(this.x - other.x, this.y - other.y);
    }

    toIntegerPoint() {
        return new Point(Math.round(this.x), Math.round(this.y));
    }
}

// Helper for rectangle operations
class Rect {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    get left() { return this.x; }
    get top() { return this.y; }
    get right() { return this.x + this.width; }
    get bottom() { return this.y + this.height; }

    get topLeft() { return new Point(this.x, this.y); }
    get topRight() { return new Point(this.x + this.width, this.y); }
    get bottomLeft() { return new Point(this.x, this.y + this.height); }
    get bottomRight() { return new Point(this.x + this.width, this.y + this.height); }

    contains(point) {
        return point.x >= this.x && point.x <= this.x + this.width &&
            point.y >= this.y && point.y <= this.y + this.height;
    }

    normalized() {
        const x = Math.min(this.x, this.x + this.width);
        const y = Math.min(this.y, this.y + this.height);
        const width = Math.abs(this.width);
        const height = Math.abs(this.height);
        return new Rect(x, y, width, height);
    }
}

// Helper for 2D transformations (mimics QTransform)
class Transform {
    constructor(m11 = 1, m12 = 0, m21 = 0, m22 = 1, dx = 0, dy = 0) {
        this.m11 = m11; // scaleX
        this.m12 = m12; // skewY
        this.m21 = m21; // skewX
        this.m22 = m22; // scaleY
        this.dx = dx;    // translateX
        this.dy = dy;    // translateY
    }

    map(point) {
        if (point instanceof Point) {
            const x = this.m11 * point.x + this.m21 * point.y + this.dx;
            const y = this.m12 * point.x + this.m22 * point.y + this.dy;
            return new Point(x, y);
        } else if (Array.isArray(point)) {
            return point.map(p => this.map(p));
        }
        return point;
    }

    inverted() {
        const det = this.m11 * this.m22 - this.m12 * this.m21;
        if (det === 0) {
            return [null, false];
        }
        const invDet = 1 / det;
        const invM11 = this.m22 * invDet;
        const invM12 = -this.m12 * invDet;
        const invM21 = -this.m21 * invDet;
        const invM22 = this.m11 * invDet;
        const invDx = -(this.dx * invM11 + this.dy * invM21);
        const invDy = -(this.dx * invM12 + this.dy * invM22);
        return [new Transform(invM11, invM12, invM21, invM22, invDx, invDy), true];
    }

    times(other) {
        const newM11 = this.m11 * other.m11 + this.m21 * other.m12;
        const newM12 = this.m12 * other.m11 + this.m22 * other.m12;
        const newM21 = this.m11 * other.m21 + this.m21 * other.m22;
        const newM22 = this.m12 * other.m21 + this.m22 * other.m22;
        const newDx = this.m11 * other.dx + this.m21 * other.dy + this.dx;
        const newDy = this.m12 * other.dx + this.m22 * other.dy + this.dy;
        return new Transform(newM11, newM12, newM21, newM22, newDx, newDy);
    }

    scale(sx, sy) {
        return this.times(new Transform(sx, 0, 0, sy, 0, 0));
    }

    translate(tx, ty) {
        return this.times(new Transform(1, 0, 0, 1, tx, ty));
    }
}

// KDTree implementation for efficient nearest neighbor search
class KDTreeNode {
    constructor(point, index, left, right, axis) {
        this.point = point; // Point object {x, y}
        this.index = index; // corresponding face index
        this.left = left;
        this.right = right;
        this.axis = axis; // splitting axis (0 for x, 1 for y)
    }
}

function buildKDTree(items, depth = 0) {
    if (!items || items.length === 0) {
        return null;
    }
    const axis = depth % 2; // 0 for x, 1 for y
    items.sort((a, b) => (axis === 0 ? a[0].x - b[0].x : a[0].y - b[0].y));
    const median = Math.floor(items.length / 2);
    return new KDTreeNode(
        items[median][0],
        items[median][1],
        buildKDTree(items.slice(0, median), depth + 1),
        buildKDTree(items.slice(median + 1), depth + 1),
        axis
    );
}

function kdTreeQuery(node, point, best = null) {
    if (node === null) {
        return best;
    }

    const axis = node.axis;
    const distSq = node.point.distanceTo(point) ** 2;

    if (best === null || distSq < best[0]) {
        best = [distSq, node.point, node.index];
    }

    const diff = (axis === 0 ? point.x : point.y) - (axis === 0 ? node.point.x : node.point.y);
    const [close, away] = diff < 0 ? [node.left, node.right] : [node.right, node.left];

    best = kdTreeQuery(close, point, best);

    if (diff ** 2 < best[0]) {
        best = kdTreeQuery(away, point, best);
    }
    return best;
}

class KDTree {
    constructor(items) {
        this.root = buildKDTree(items);
    }

    query(point) {
        const result = kdTreeQuery(this.root, point);
        return result; // [dist_sq, point, index]
    }
}

// Point in Polygon check (ray casting algorithm)
function isPointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        const intersect = ((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// --- Custom Modal and Message Box Implementations ---
const modalContainer = document.getElementById('modal-container');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalOkBtn = document.getElementById('modal-ok-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

let modalResolve;

/**
 * Displays a custom modal dialog.
 * @param {string} title - The title of the modal.
 * @param {string} contentHtml - The HTML content to display in the modal body.
 * @param {boolean} showCancel - Whether to show the cancel button.
 * @returns {Promise<boolean>} - A promise that resolves to true if OK is clicked, false if Cancel.
 */
function showModal(title, contentHtml, showCancel = true) {
    return new Promise(resolve => {
        modalTitle.textContent = title;
        modalBody.innerHTML = contentHtml;
        modalCancelBtn.classList.toggle('hidden', !showCancel);
        modalContainer.classList.remove('hidden');

        const handleOk = () => {
            modalContainer.classList.add('hidden');
            modalOkBtn.removeEventListener('click', handleOk);
            modalCancelBtn.removeEventListener('click', handleCancel);
            resolve(true);
        };

        const handleCancel = () => {
            modalContainer.classList.add('hidden');
            modalOkBtn.removeEventListener('click', handleOk);
            modalCancelBtn.removeEventListener('click', handleCancel);
            resolve(false);
        };

        modalOkBtn.addEventListener('click', handleOk);
        modalCancelBtn.addEventListener('click', handleCancel);
        modalResolve = resolve; // Store resolve for external use if needed
    });
}

const messageBoxContainer = document.getElementById('message-box-container');
const messageBoxIcon = document.getElementById('message-box-icon');
const messageBoxTitle = document.getElementById('message-box-title');
const messageBoxMessage = document.getElementById('message-box-message');
const messageBoxCheckboxContainer = document.getElementById('message-box-checkbox-container');
const messageBoxCheckbox = document.getElementById('message-box-checkbox');
const messageBoxCheckboxLabel = document.getElementById('message-box-checkbox-label');
const messageBoxOkBtn = document.getElementById('message-box-ok-btn');
const messageBoxCancelBtn = document.getElementById('message-box-cancel-btn');

let messageBoxResolve;

/**
 * Displays a custom message box with an icon, title, message, and optional checkbox.
 * @param {string} title - The title of the message box.
 * @param {string} message - The message content.
 * @param {'info'|'warning'|'error'|'question'} type - The type of message (influences icon).
 * @param {boolean} showCancel - Whether to show the cancel button.
 * @param {boolean} showCheckbox - Whether to show a checkbox.
 * @param {string} checkboxLabel - The label for the checkbox.
 * @returns {Promise<{confirmed: boolean, checkboxChecked: boolean}>} - A promise that resolves with confirmation and checkbox state.
 */
function showMessageBox(title, message, type = 'info', showCancel = false, showCheckbox = false, checkboxLabel = '') {
    return new Promise(resolve => {
        messageBoxTitle.textContent = title;
        messageBoxMessage.textContent = message;
        messageBoxCheckboxContainer.classList.toggle('hidden', !showCheckbox);
        messageBoxCheckbox.checked = false; // Reset checkbox state
        messageBoxCheckboxLabel.textContent = checkboxLabel;
        messageBoxCancelBtn.classList.toggle('hidden', !showCancel);
        messageBoxContainer.classList.remove('hidden');

        const iconMap = {
            info: `<svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
            warning: `<svg class="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.302 16c-.77 1.333.192 3 1.732 3z"></path></svg>`,
            error: `<svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
            question: `<svg class="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9.247a4.75 4.75 0 015.657 0M15 12a3 3 0 11-6 0 3 3 0 016 0zm-7.5 3h1.5m4.5 0h1.5m-7.5 3h1.5m4.5 0h1.5M12 21a9 9 0 110-18 9 9 0 010 18z"></path></svg>`,
        };
        messageBoxIcon.innerHTML = iconMap[type] || '';

        const handleOk = () => {
            messageBoxContainer.classList.add('hidden');
            messageBoxOkBtn.removeEventListener('click', handleOk);
            messageBoxCancelBtn.removeEventListener('click', handleCancel);
            resolve({ confirmed: true, checkboxChecked: messageBoxCheckbox.checked });
        };

        const handleCancel = () => {
            modalContainer.classList.add('hidden');
            messageBoxOkBtn.removeEventListener('click', handleOk);
            messageBoxCancelBtn.removeEventListener('click', handleCancel);
            resolve({ confirmed: false, checkboxChecked: messageBoxCheckbox.checked });
        };

        messageBoxOkBtn.addEventListener('click', handleOk);
        messageBoxCancelBtn.addEventListener('click', handleCancel);
        messageBoxResolve = resolve;
    });
}

// --- Custom Save Dialog ---
/**
 * Displays a custom save file dialog.
 * @param {string} title - The title of the save dialog.
 * @param {string} defaultFilename - The default filename to pre-fill the input.
 * @param {string} extension - The required file extension (e.g., '.obj', '.kufi').
 * @returns {Promise<string|null>} - A promise that resolves with the filename or null if cancelled.
 */
function showSaveDialog(title, defaultFilename, extension) {
    return new Promise(resolve => {
        const inputId = 'save-filename-input';
        const contentHtml = `
            <div class="space-y-4">
                <div>
                    <label for="${inputId}" class="block text-gray-700 text-sm font-bold mb-2" data-lang-key="filenameLabel">Filename:</label>
                    <input id="${inputId}" type="text" value="${defaultFilename}"
                        class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
                </div>
            </div>
        `;
        showModal(title, contentHtml, true).then(confirmed => {
            if (confirmed) {
                let filename = document.getElementById(inputId).value.trim();
                if (filename) {
                    // Ensure the correct extension is present
                    if (!filename.endsWith(extension)) {
                        filename += extension;
                    }
                    resolve(filename);
                } else {
                    // If filename is empty after trim, consider it cancelled or invalid
                    showMessageBox(translations[currentLanguage].invalidFilenameTitle, translations[currentLanguage].invalidFilenameMessage, 'warning');
                    resolve(null); // Or prompt again, depending on desired strictness
                }
            } else {
                resolve(null); // User cancelled
            }
        });
    });
}

// --- Global State ---
let vertices = [];
let faces = [];
let faceColors = {}; // {faceIndex: "rgba(r,g,b,a)"}
let selectedFaces = new Set();

let movePoints = null; // {faceIndex: {color: "rgba", pos: Point}}
let selectedPoints = new Set();

let currentTool = 'paint';
let fillColor = 'rgba(255, 104, 104, 1)';

let isPainting = false;
let activePaintTool = null; // 'paint' or 'erase'
let strokeInProgress = false;

let isSelecting = false;
let selectStart = null; // Point
let selectRect = null; // Rect
let selectModifiers = 0; // 0: none, 1: Ctrl/Cmd

let isMovingSelection = false;
let moveStartPos = null; // Point
let moveDelta = new Point(0, 0); // Point
let moveOriginalState = {}; // For points: {key: originalPoint}, for faces: {face: color}
let moveOriginalSelected = new Set(); // Keys/faces that were selected at start of move

let isRotatingSelection = false;
let rotateStartPos = null; // Point
let rotateCurrentPos = null; // Point
let rotateOriginalState = {}; // For points: {key: originalPoint}, for faces: {face: color}
let rotateOriginalSelected = new Set(); // Keys/faces that were selected at start of rotate

let zoom = 1.0;
let panOffset = new Point(0, 0); // panOffset is in screen pixels
let middleMouseDown = false;
let isPanningCanvas = false; // New state variable for left-click canvas pan
let lastPanPoint = null;

// Pinch-to-zoom specific states
let isPinching = false;
let initialPinchDistance = 0;
let initialPinchMidpoint = new Point(0, 0);
let initialZoom = 1.0;
let initialPanOffset = new Point(0, 0);


let undoStack = [];
let redoStack = [];
const maxUndoStackSize = 30;

let faceCenters = []; // Array of Point
let cachedFacePolygons = []; // Array of arrays of Points
let cachedFacePaths = []; // Array of Path2D objects
let kdTree = null;

let currentFilePath = null;
let isModified = false;

let exportResolution = { width: 3500, height: 3500 };

// --- DOM Elements ---
const canvas = document.getElementById('objCanvas');
const ctx = canvas.getContext('2d');
const statusBar = document.getElementById('status-bar');

const loadObjButton = document.getElementById('load-obj-button'); // Get the button
const loadObjInput = document.getElementById('load-obj-input');
const openProjectButton = document.getElementById('open-project-button'); // Get the button
const openProjectInput = document.getElementById('open-project-input');
const saveProjectBtn = document.getElementById('save-project-btn');
const saveProjectAsBtn = document.getElementById('save-project-as-btn');
const exportSvgBtn = document.getElementById('export-svg-btn');
const exportPngBtn = document.getElementById('export-png-btn');
const clearCanvasBtn = document.getElementById('clear-canvas-btn');

const toolPaintBtn = document.getElementById('tool-paint');
const toolEraseBtn = document.getElementById('tool-erase');
const toolMoveBtn = document.getElementById('tool-move');
const colorPalette = document.getElementById('color-palette');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');

// Language elements
const flagEn = document.getElementById('flag-en');
const flagTr = document.getElementById('flag-tr');
const flagAr = document.getElementById('flag-ar');

// --- Performance Optimization: Request Animation Frame for drawing ---
let needsRedraw = false;

/**
 * Requests a redraw of the canvas on the next animation frame.
 */
function requestRedraw() {
    if (!needsRedraw) {
        needsRedraw = true;
        requestAnimationFrame(animate);
    }
}

/**
 * The main animation loop for drawing the canvas content.
 */
function animate() {
    if (needsRedraw) {
        draw();
        needsRedraw = false;
    }
}

// --- Language and Translation ---
let currentLanguage = localStorage.getItem('appLanguage') || 'en';

const translations = {
    en: {
        loadObj: 'Load OBJ',
        openProject: 'Open Project',
        saveProject: 'Save Project',
        saveProjectAs: 'Save Project As',
        exportSvg: 'Export SVG',
        exportPng: 'Export PNG',
        clear: 'Clear',
        paintTool: 'Paint',
        eraseTool: 'Erase',
        moveTool: 'Move',
        colorsTitle: 'Colors:',
        undo: 'Undo',
        redo: 'Redo',
        readyStatus: 'Ready',
        canvasPlaceholder: 'Load a 3D OBJ file to start...',
        unsavedChangesTitle: 'Unsaved Changes',
        unsavedChangesMessage: 'There are unsaved changes. Do you want to save them now?',
        errorTitle: 'Error',
        objLoadErrorMessage: 'Failed to load OBJ file or file is empty.',
        projectLoadErrorMessage: 'Failed to load project file.',
        successTitle: 'Success',
        projectLoadedMessage: 'Project loaded.',
        saveCancelledMessage: 'Project save was cancelled.',
        projectSavedMessage: (filename) => `Project saved as "${filename}".`,
        filenameLabel: 'Filename:',
        invalidFilenameTitle: 'Invalid Filename',
        invalidFilenameMessage: 'Filename cannot be empty.',
        exportResolutionTitle: 'Export Resolution',
        exportCancelledMessage: (type) => `${type} export was cancelled.`,
        svgExportSuccessMessage: (filename) => `SVG successfully exported as "${filename}".`,
        pngExportSuccessMessage: (filename) => `PNG successfully exported as "${filename}".`,
        noContentMessage: 'There is no content to export.',
        clearCanvasTitle: 'Clear Canvas',
        clearCanvasMessage: 'Do you want to clear all painted faces?',
        canvasClearedMessage: 'Canvas cleared.',
        canvasAlreadyEmpty: 'Canvas is already empty.',
        usageInstructionsTitle: 'Usage Instructions',
        usageInstructionsMessage: `Instructions:\n\n` +
            `1) Load a 3D OBJ file with 'Load OBJ' (Ctrl+L).\n` +
            `   The file is shown in top-down view (orthonormal projection).\n` +
            `2) Paint/erase faces in 'Paint' or 'Erase' mode.\n` +
            `3) Switch to 'Move' mode: painted faces convert to points.\n` +
            `   (If no faces are painted, white points appear at all face centers.)\n` +
            `4) In 'Move' mode, select points (click or marquee) to drag or rotate.\n` +
            `   Points are drawn at a fixed size (e.g., 10px) in widget coordinates.\n` +
            `5) While selecting, a selection rectangle appears (unfilled).\n` +
            `6) Points snap to the nearest face when switching out of 'Move' mode.\n` +
            `7) Pan with middle mouse button, or left-click drag when no tool is active.\n` +
            `8) Zoom with Ctrl+scroll (zooms around cursor).\n` +
            `9) Undo/Redo with Ctrl+Z / Ctrl+Y.\n\n` +
            `Happy creating!`,
        dontShowAgain: "Don't show again",
        okButton: "OK",
        cancelButton: "Cancel",
        colorBlack: 'Black',
        // colorWhite: 'White', // Removed
        colorRed: 'Red',
        colorGreen: 'Green',
        colorBlue: 'Blue',
        colorYellow: 'Yellow',
        colorCyan: 'Cyan',
        colorMagenta: 'Magenta',
        colorOrange: 'Orange',
        colorPurple: 'Purple',
        colorBrown: 'Brown',
        // colorGray: 'Gray', // Removed
    },
    tr: {
        loadObj: 'OBJ Yükle',
        openProject: 'Proje Aç',
        saveProject: 'Projeyi Kaydet',
        saveProjectAs: 'Projeyi Farklı Kaydet',
        exportSvg: 'SVG Dışa Aktar',
        exportPng: 'PNG Dışa Aktar',
        clear: 'Temizle',
        paintTool: 'Boyama',
        eraseTool: 'Silgi',
        moveTool: 'Taşı',
        colorsTitle: 'Renkler:',
        undo: 'Geri Al',
        redo: 'Yinele',
        readyStatus: 'Hazır',
        canvasPlaceholder: 'Başlamak için bir 3D OBJ dosyası yükleyin...',
        unsavedChangesTitle: 'Kaydedilmemiş Değişiklikler',
        unsavedChangesMessage: 'Kaydedilmemiş değişiklikler var. Şimdi kaydetmek ister misiniz?',
        errorTitle: 'Hata',
        objLoadErrorMessage: 'OBJ dosyası yüklenemedi veya dosya boş.',
        projectLoadErrorMessage: 'Proje dosyası yüklenemedi.',
        successTitle: 'Başarılı',
        projectLoadedMessage: 'Proje yüklendi.',
        saveCancelledMessage: 'Proje kaydetme iptal edildi.',
        projectSavedMessage: (filename) => `Proje "${filename}" olarak kaydedildi.`,
        filenameLabel: 'Dosya Adı:',
        invalidFilenameTitle: 'Geçersiz Dosya Adı',
        invalidFilenameMessage: 'Dosya adı boş olamaz.',
        exportResolutionTitle: 'Dışa Aktarma Çözünürlüğü',
        exportCancelledMessage: (type) => `${type} dışa aktarma iptal edildi.`,
        svgExportSuccessMessage: (filename) => `SVG başarıyla "${filename}" olarak dışa aktarıldı.`,
        pngExportSuccessMessage: (filename) => `PNG başarıyla "${filename}" olarak dışa aktarıldı.`,
        noContentMessage: 'Dışa aktarılacak içerik yok.',
        clearCanvasTitle: 'Tuvali Temizle',
        clearCanvasMessage: 'Tüm boyalı yüzeyleri temizlemek istiyor musunuz?',
        canvasClearedMessage: 'Tuval temizlendi.',
        canvasAlreadyEmpty: 'Tuval zaten boş.',
        usageInstructionsTitle: 'Kullanım Talimatları',
        usageInstructionsMessage: `Talimatlar:\n\n` +
            `1) 'OBJ Yükle' (Ctrl+L) ile bir 3D OBJ dosyası yükleyin.\n` +
            `   Dosya yukarıdan aşağıya görünümde (ortogonal projeksiyon) gösterilir.\n` +
            `2) 'Boyama' veya 'Silgi' modunda yüzeyleri boyayın/silin.\n` +
            `3) 'Taşı' moduna geçin: boyalı yüzeyler noktalara dönüşür.\n` +
            `   (Hiçbir yüzey boyanmamışsa, tüm yüzey merkezlerinde beyaz noktalar görünür.)\n` +
            `4) 'Taşı' modunda, sürüklemek veya döndürmek için noktaları (tıklayarak veya seçim kutusuyla) seçin.\n` +
            `   Noktalar widget koordinatlarında sabit bir boyutta (örn. 10 piksel) çizilir.\n` +
            `5) Seçim yaparken bir seçim dikdörtgeni görünür (içi boş).\n` +
            `6) 'Taşı' modundan çıkarken noktalar en yakın yüzeye yapışır.\n` +
            `7) Orta fare tuşuyla veya hiçbir araç etkin değilken sol tıklama sürüklemesiyle kaydırın.\n` +
            `8) Ctrl+kaydırma ile yakınlaştırın (imleç etrafında yakınlaştırır).\n` +
            `9) Ctrl+Z / Ctrl+Y ile Geri Al/Yinele.\n\n` +
            `Mutlu yaratımlar!`,
        dontShowAgain: "Tekrar gösterme",
        okButton: "Tamam",
        cancelButton: "İptal",
        colorBlack: 'Siyah',
        // colorWhite: 'Beyaz', // Removed
        colorRed: 'Kırmızı',
        colorGreen: 'Yeşil',
        colorBlue: 'Mavi',
        colorYellow: 'Sarı',
        colorCyan: 'Camgöbeği',
        colorMagenta: 'Macenta',
        colorOrange: 'Turuncu',
        colorPurple: 'Mor',
        colorBrown: 'Kahverengi',
        // colorGray: 'Gri', // Removed
    },
    ar: {
        loadObj: 'تحميل OBJ',
        openProject: 'فتح مشروع',
        saveProject: 'حفظ المشروع',
        saveProjectAs: 'حفظ المشروع باسم',
        exportSvg: 'تصدير SVG',
        exportPng: 'تصدير PNG',
        clear: 'مسح',
        paintTool: 'طلاء',
        eraseTool: 'مسح',
        moveTool: 'نقل',
        colorsTitle: 'الألوان:',
        undo: 'تراجع',
        redo: 'إعادة',
        readyStatus: 'جاهز',
        canvasPlaceholder: 'قم بتحميل ملف OBJ ثلاثي الأبعاد للبدء...',
        unsavedChangesTitle: 'تغييرات غير محفوظة',
        unsavedChangesMessage: 'هناك تغييرات غير محفوظة. هل تريد حفظها الآن؟',
        errorTitle: 'خطأ',
        objLoadErrorMessage: 'فشل تحميل ملف OBJ أو الملف فارغ.',
        projectLoadErrorMessage: 'فشل تحميل ملف المشروع.',
        successTitle: 'نجاح',
        projectLoadedMessage: 'تم تحميل المشروع.',
        saveCancelledMessage: 'تم إلغاء حفظ المشروع.',
        projectSavedMessage: (filename) => `تم حفظ المشروع باسم "${filename}".`,
        filenameLabel: 'اسم الملف:',
        invalidFilenameTitle: 'اسم ملف غير صالح',
        invalidFilenameMessage: 'لا يمكن أن يكون اسم الملف فارغًا.',
        exportResolutionTitle: 'دقة التصدير',
        exportCancelledMessage: (type) => `تم إلغاء تصدير ${type}.`,
        svgExportSuccessMessage: (filename) => `تم تصدير SVG بنجاح باسم "${filename}".`,
        pngExportSuccessMessage: (filename) => `تم تصدير PNG بنجاح باسم "${filename}".`,
        noContentMessage: 'لا يوجد محتوى للتصدير.',
        clearCanvasTitle: 'مسح اللوحة',
        clearCanvasMessage: 'هل تريد مسح جميع الوجوه المطلية؟',
        canvasClearedMessage: 'تم مسح اللوحة.',
        canvasAlreadyEmpty: 'اللوحة فارغة بالفعل.',
        usageInstructionsTitle: 'تعليمات الاستخدام',
        usageInstructionsMessage: `التعليمات:\n\n` +
            `1) قم بتحميل ملف OBJ ثلاثي الأبعاد باستخدام "تحميل OBJ" (Ctrl+L).\n` +
            `   يتم عرض الملف في عرض من الأعلى (إسقاط متعامد).\n` +
            `2) قم بطلاء/مسح الوجوه في وضع "الطلاء" أو "المسح".\n` +
            `3) قم بالتبديل إلى وضع "النقل": تتحول الوجوه المطلية إلى نقاط.\n` +
            `   (إذا لم يتم طلاء أي وجوه، تظهر نقاط بيضاء في جميع مراكز الوجوه.)\n` +
            `4) في وضع "النقل"، حدد النقاط (بالنقر أو التحديد المستطيل) لسحبها أو تدويرها.\n` +
            `   يتم رسم النقاط بحجم ثابت (مثل 10 بكسل) في إحداثيات الأداة.\n` +
            `5) أثناء التحديد، يظهر مستطيل التحديد (غير مملوء).\n` +
            `6) تلتصق النقاط بأقرب وجه عند التبديل من وضع "النقل".\n` +
            `7) قم بالتحريك بزر الفأرة الأوسط، أو السحب بالزر الأيسر عندما لا تكون أي أداة نشطة.\n` +
            `8) قم بالتكبير/التصغير باستخدام Ctrl+scroll (يكبر حول المؤشر).\n` +
            `9) تراجع/إعادة باستخدام Ctrl+Z / Ctrl+Y.\n\n` +
            `استمتع بالإبداع!`,
        dontShowAgain: "لا تظهر مرة أخرى",
        okButton: "موافق",
        cancelButton: "إلغاء",
        colorBlack: 'أسود',
        // colorWhite: 'أبيض', // Removed
        colorRed: 'أحمر',
        colorGreen: 'أخضر',
        colorBlue: 'أزرق',
        colorYellow: 'أصفر',
        colorCyan: 'سماوي',
        colorMagenta: 'أرجواني',
        colorOrange: 'برتقالي',
        colorPurple: 'بنفسجي',
        colorBrown: 'بني',
        // colorGray: 'رمادي', // Removed
    }
};

/**
 * Sets the application language and updates the UI.
 * @param {string} lang - The language code (e.g., 'en', 'tr', 'ar').
 */
function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('appLanguage', lang);
    updateUIForLanguage();
}

/**
 * Updates all UI elements with the current language's translations.
 */
function updateUIForLanguage() {
    const elements = document.querySelectorAll('[data-lang-key]');
    elements.forEach(el => {
        const key = el.dataset.langKey;
        // Check if the translation is a function (like for projectSavedMessage)
        if (typeof translations[currentLanguage][key] === 'function') {
            // For now, we set a placeholder. Dynamic messages are updated when the event fires.
            el.textContent = translations[currentLanguage][key]('');
        } else if (translations[currentLanguage][key]) {
            el.textContent = translations[currentLanguage][key];
        }
    });

    // Update specific elements that need dynamic content or special handling
    const canvasPlaceholderSpan = document.getElementById('canvas-placeholder-text');
    if (canvasPlaceholderSpan) {
        canvasPlaceholderSpan.textContent = translations[currentLanguage].canvasPlaceholder;
    }

    // Update color names in the palette
    const colorButtons = document.querySelectorAll('#color-palette button');
    colors.forEach((col, index) => {
        const button = colorButtons[index];
        if (button) {
            const colorNameKey = `color${col.name}`; // e.g., 'colorBlack'
            if (translations[currentLanguage][colorNameKey]) {
                button.textContent = translations[currentLanguage][colorNameKey];
            }
        }
    });

    // Update active flag visual
    document.querySelectorAll('.flag-icon').forEach(flag => {
        flag.classList.remove('active');
    });
    document.getElementById(`flag-${currentLanguage}`).classList.add('active');
}

// --- Functions ---

/**
 * Updates the document title based on the current file path and modification status.
 */
function updateTitle() {
    const baseTitle = "Vector OBJ Painting Editor";
    let title = baseTitle;
    if (currentFilePath) {
        const filename = currentFilePath.split('/').pop().split('\\').pop();
        title = `${baseTitle} - ${filename}`;
    }
    if (isModified) {
        title += " *";
    }
    document.title = title;
}

/**
 * Marks the project as modified and updates the title.
 */
function onProjectModified() {
    if (!isModified) {
        isModified = true;
        updateTitle();
    }
}

/**
 * Loads OBJ file content into the application's state.
 * @param {string} fileContent - The content of the OBJ file.
 */
function loadObjFileContent(fileContent) {
    const verts = [];
    const fcs = [];
    const lines = fileContent.split('\n');
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue;
        }
        const parts = trimmedLine.split(/\s+/);
        if (parts[0] === 'v' && parts.length >= 4) {
            try {
                const x = parseFloat(parts[1]);
                const y = parseFloat(parts[2]);
                const z = parseFloat(parts[3]);
                verts.push([x, y, z]);
            } catch (e) {
                console.error("Error parsing vertex:", e);
                continue;
            }
        } else if (parts[0] === 'f' && parts.length >= 3) {
            const indices = [];
            for (let i = 1; i < parts.length; i++) {
                try {
                    const idx = parseInt(parts[i].split('/')[0]) - 1;
                    indices.push(idx);
                } catch (e) {
                    console.error("Error parsing face index:", e);
                    continue;
                }
            }
            if (indices.length >= 3) {
                fcs.push(indices);
            }
        }
    }

    if (verts.length === 0 || fcs.length === 0) {
        showMessageBox(translations[currentLanguage].errorTitle, translations[currentLanguage].objLoadErrorMessage, 'error');
        return;
    }

    vertices = verts;
    faces = fcs;
    faceColors = {};
    selectedFaces = new Set();
    movePoints = null;
    selectedPoints = new Set();
    undoStack = [];
    redoStack = [];
    zoom = 1.0;
    panOffset = new Point(0, 0);
    currentFilePath = null;
    isModified = true;
    computeFaceCenters();
    cacheFacePolygons();
    requestRedraw();
    updateTitle();
    statusBar.textContent = translations[currentLanguage].readyStatus;
    setTimeout(() => statusBar.textContent = translations[currentLanguage].readyStatus, 3000);
}

/**
 * Calculates the bounding box of the loaded OBJ model (min/max X and Z coordinates).
 * @returns {{min_x: number, max_x: number, min_z: number, max_z: number}} The bounding box coordinates.
 */
function boundingBox() {
    if (vertices.length === 0) {
        return { min_x: 0, max_x: 0, min_z: 0, max_z: 0 };
    }
    let min_x = Infinity, max_x = -Infinity;
    let min_z = Infinity, max_z = -Infinity;
    for (const v of vertices) {
        min_x = Math.min(min_x, v[0]);
        max_x = Math.max(max_x, v[0]);
        min_z = Math.min(min_z, v[2]);
        max_z = Math.max(max_z, v[2]);
    }
    return { min_x, max_x, min_z, max_z };
}

/**
 * Computes the transformation matrix for drawing the model on the canvas.
 * This includes scaling to fit, Y-axis flip, and user-applied pan/zoom.
 * @returns {Transform} The calculated transformation matrix.
 */
function computeTransform() {
    if (!canvas || vertices.length === 0) {
        return new Transform();
    }
    const margin = 20;
    const w = canvas.width;
    const h = canvas.height;

    const { min_x, max_x, min_z, max_z } = boundingBox();
    const modelWidth = max_x - min_x;
    const modelHeight = max_z - min_z;

    let s = 1.0;
    if (modelWidth > 0 && modelHeight > 0) {
        s = Math.min((w - 2 * margin) / modelWidth, (h - 2 * margin) / modelHeight);
    }

    // Base transform to fit model into canvas with Y-axis flip
    // The Y-axis is flipped because OBJ's Z-axis often maps to canvas Y-axis,
    // and canvas Y-axis increases downwards, while 3D Z-axis usually increases upwards.
    const baseTransform = new Transform(s, 0, 0, -s, margin - s * min_x, margin + s * max_z);

    // User transform for pan and zoom (applied after base transform)
    const userTransform = new Transform()
        .scale(zoom, zoom)
        .translate(panOffset.x, panOffset.y);

    return userTransform.times(baseTransform);
}

/**
 * Computes the center point for each face and builds a KD-Tree for efficient nearest face lookup.
 */
function computeFaceCenters() {
    faceCenters = [];
    for (const face of faces) {
        let sumX = 0;
        let sumZ = 0;
        let count = 0;
        for (const idx of face) {
            if (idx >= 0 && idx < vertices.length) {
                const v = vertices[idx];
                sumX += v[0];
                sumZ += v[2];
                count++;
            }
            else {
                console.warn(`Invalid vertex index ${idx} in face. Skipping.`);
            }
        }
        if (count > 0) {
            faceCenters.push(new Point(sumX / count, sumZ / count));
        } else {
            // If a face has no valid vertices, push a default point to maintain index alignment
            faceCenters.push(new Point(0, 0));
        }
    }
    const items = faceCenters.map((p, i) => [p, i]);
    kdTree = new KDTree(items);
}

/**
 * Caches the polygonal paths for each face for efficient drawing.
 */
function cacheFacePolygons() {
    cachedFacePolygons = [];
    cachedFacePaths = [];
    for (const face of faces) {
        const poly = [];
        const path = new Path2D();
        let first = true;
        for (const idx of face) {
            if (idx >= 0 && idx < vertices.length) {
                const v = vertices[idx];
                const p = new Point(v[0], v[2]);
                poly.push(p);
                if (first) {
                    path.moveTo(p.x, p.y);
                    first = false;
                } else {
                    path.lineTo(p.x, p.y);
                }
            }
        }
        if (poly.length > 0) {
            path.closePath();
        }
        cachedFacePolygons.push(poly);
        cachedFacePaths.push(path);
    }
}

/**
 * Gets the center point of a specific face.
 * @param {number} faceIndex - The index of the face.
 * @returns {Point} The center point of the face.
 */
function getFaceCenter(faceIndex) {
    if (faceIndex < 0 || faceIndex >= faceCenters.length) {
        return new Point(0, 0);
    }
    return faceCenters[faceIndex];
}

/**
 * Finds the closest face to a given point using the KD-Tree.
 * @param {Point} target - The point to search around.
 * @returns {number|null} The index of the closest face, or null if no faces.
 */
function findClosestFace(target) {
    if (kdTree) {
        const result = kdTree.query(target);
        return result ? result[2] : null;
    }
    let bestIndex = null;
    let bestDist = Infinity;
    for (let i = 0; i < faceCenters.length; i++) {
        const center = faceCenters[i];
        const d = center.distanceTo(target);
        if (d < bestDist) {
            bestDist = d;
            bestIndex = i;
        }
    }
    return bestIndex;
}

/**
 * Switches the active tool and updates the UI accordingly. Handles transitions between 'paint', 'erase', and 'move' modes.
 * @param {'paint'|'erase'|'move'} newTool - The tool to switch to.
 */
function switchTool(newTool) {
    // Update UI for tool buttons
    document.querySelectorAll('#tool-paint, #tool-erase, #tool-move').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'border-yellow-400');
        btn.classList.add('bg-gray-700', 'hover:bg-gray-600', 'border-transparent');
    });
    document.getElementById(`tool-${newTool}`).classList.add('bg-blue-600', 'border-2', 'border-yellow-400');
    document.getElementById(`tool-${newTool}`).classList.remove('bg-gray-700', 'hover:bg-gray-600', 'border-transparent');

    // Logic for converting between faceColors and movePoints based on tool change
    if (newTool === "move" && currentTool !== "move") {
        const newMovePoints = {};
        if (Object.keys(faceColors).length > 0) {
            for (const faceIdxStr in faceColors) {
                const faceIdx = parseInt(faceIdxStr);
                const pos = getFaceCenter(faceIdx);
                newMovePoints[faceIdx] = {
                    color: faceColors[faceIdx],
                    pos: new Point(pos.x, pos.y),
                };
            }
        } else {
            // If no faces are painted, show all face centers as white points
            for (let i = 0; i < faces.length; i++) {
                const pos = getFaceCenter(i);
                newMovePoints[i] = {
                    color: 'rgba(255, 255, 255, 1)', // Default white for unpainted faces
                    pos: new Point(pos.x, pos.y),
                };
            }
        }
        movePoints = newMovePoints;
        selectedPoints = new Set();
        faceColors = {}; // Clear faceColors when switching to move mode
    } else if (newTool !== "move" && currentTool === "move") {
        // When leaving move mode, snap points to nearest faces
        if (movePoints) {
            const newFaceColors = {};
            for (const keyStr in movePoints) {
                const key = parseInt(keyStr);
                const data = movePoints[key];
                const newFace = findClosestFace(data.pos);
                if (newFace !== null) {
                    newFaceColors[newFace] = data.color;
                }
            }
            faceColors = newFaceColors;
        }
        movePoints = null;
        selectedPoints = new Set();
    }
    currentTool = newTool;
    requestRedraw();
}

/**
 * Identifies if a point is within the radius of any movable point in 'move' mode.
 * @param {Point} pos - The screen coordinates to check.
 * @returns {number|null} The index of the point if found, otherwise null.
 */
function pointAt(pos) {
    if (!movePoints) return null;
    const T = computeTransform();
    const threshold = 10; // Click radius for points
    for (const keyStr in movePoints) {
        const key = parseInt(keyStr);
        const data = movePoints[key];
        const pointWidget = T.map(data.pos);
        const dist = pointWidget.distanceTo(pos);
        if (dist < threshold) {
            return key;
        }
    }
    return null;
}

/**
 * Calculates the bounding rectangle of the current selection (faces or points).
 * @returns {Rect|null} The bounding rectangle in canvas coordinates, or null if nothing is selected.
 */
function getSelectionBoundingRect() {
    const T = computeTransform();
    let points = [];
    if (currentTool === "move" && movePoints && selectedPoints.size > 0) {
        for (const key of selectedPoints) {
            if (movePoints[key]) {
                points.push(T.map(movePoints[key].pos));
            }
        }
    } else if (selectedFaces.size > 0) {
        for (const faceIdx of selectedFaces) {
            points.push(T.map(getFaceCenter(faceIdx)));
        }
    } else {
        return null;
    }

    if (points.length === 0) return null;

    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    return new Rect(minX, minY, maxX - minX, maxY - minY);
}

/**
 * Pushes the current application state onto the undo stack.
 */
function pushUndoState() {
    const newState = {
        faceColors: { ...faceColors },
        selectedFaces: new Set(selectedFaces),
        movePoints: movePoints ? JSON.parse(JSON.stringify(movePoints)) : null, // Deep copy movePoints
        selectedPoints: new Set(selectedPoints),
    };
    undoStack.push(newState);
    if (undoStack.length > maxUndoStackSize) {
        undoStack.shift(); // Remove oldest state
    }
    redoStack = []; // Clear redo stack on new action
}

/**
 * Reverts the application state to the previous state on the undo stack.
 */
function undo() {
    if (undoStack.length === 0) return;

    // Save current state to redo stack
    redoStack.push({
        faceColors: { ...faceColors },
        selectedFaces: new Set(selectedFaces),
        movePoints: movePoints ? JSON.parse(JSON.stringify(movePoints)) : null,
        selectedPoints: new Set(selectedPoints),
    });

    const lastState = undoStack.pop();
    faceColors = lastState.faceColors;
    selectedFaces = lastState.selectedFaces;
    movePoints = lastState.movePoints;
    selectedPoints = lastState.selectedPoints;
    onProjectModified(); // Mark as modified if state changed
    requestRedraw();
}

/**
 * Reapplies the next state from the redo stack.
 */
function redo() {
    if (redoStack.length === 0) return;

    // Save current state to undo stack
    undoStack.push({
        faceColors: { ...faceColors },
        selectedFaces: new Set(selectedFaces),
        movePoints: movePoints ? JSON.parse(JSON.stringify(movePoints)) : null,
        selectedPoints: new Set(selectedPoints),
    });

    const nextState = redoStack.pop();
    faceColors = nextState.faceColors;
    selectedFaces = nextState.selectedFaces;
    movePoints = nextState.movePoints;
    selectedPoints = nextState.selectedPoints;
    onProjectModified(); // Mark as modified if state changed
    requestRedraw();
}

/**
 * Applies paint or erase action at the given screen position.
 * @param {Point} pos - The screen coordinates of the pointer.
 * @param {'paint'|'erase'} tool - The active painting tool.
 */
function paintAt(pos, tool) {
    const T = computeTransform();
    const [invertedT, ok] = T.inverted();
    if (!ok) return;

    const modelPos = invertedT.map(pos);

    let foundFaceIndex = null;
    // Iterate faces in reverse order to pick the topmost one visually
    for (let i = cachedFacePolygons.length - 1; i >= 0; i--) {
        const poly = cachedFacePolygons[i];
        if (isPointInPolygon(modelPos, poly)) {
            foundFaceIndex = i;
            break;
        }
    }

    if (foundFaceIndex === null) {
        return;
    }

    if (tool === "paint") {
        if (faceColors[foundFaceIndex] !== fillColor) {
            faceColors[foundFaceIndex] = fillColor;
            onProjectModified();
            requestRedraw();
        }
    } else if (tool === "erase") {
        if (faceColors.hasOwnProperty(foundFaceIndex)) {
            delete faceColors[foundFaceIndex];
            if (selectedFaces.has(foundFaceIndex)) {
                selectedFaces.delete(foundFaceIndex);
            }
            onProjectModified();
            requestRedraw();
        }
    }
}

/**
 * Updates the positions of selected points/faces based on the current move delta.
 * This is used for real-time visual feedback during a drag operation.
 */
function updateMovePreview() {
    if (!moveOriginalSelected || moveOriginalSelected.size === 0) return;

    const T = computeTransform();
    const [invT, ok] = T.inverted();
    if (!ok) return;

    if (movePoints) {
        // Calculate the delta in model coordinates
        const deltaModel = invT.map(moveDelta).subtract(invT.map(new Point(0, 0)));
        for (const key of moveOriginalSelected) {
            const origPos = moveOriginalState[key];
            if (origPos) {
                movePoints[key].pos = origPos.add(deltaModel);
            }
        }
        selectedPoints = new Set(moveOriginalSelected); // Ensure selected points remain selected during drag
    } else {
        // This block is for moving face colors, which isn't currently used with movePoints being active
        // but kept for completeness if future logic shifts.
        const newFaceColorsPreview = { ...moveOriginalState };
        const previewMapping = {};
        const previewSelected = new Set();

        let groupCenter = new Point(0, 0);
        let count = 0;
        for (const faceIdx of moveOriginalSelected) {
            groupCenter = groupCenter.add(getFaceCenter(faceIdx));
            count++;
        }
        if (count > 0) {
            groupCenter = new Point(groupCenter.x / count, groupCenter.y / count);
        }

        const deltaX = moveDelta.x / zoom; // Adjust delta to model coordinates based on current zoom
        const deltaY = moveDelta.y / zoom;
        const newGroupCenter = groupCenter.add(new Point(deltaX, deltaY));

        for (const faceIdx of moveOriginalSelected) {
            const originalCenter = getFaceCenter(faceIdx);
            const rel = originalCenter.subtract(groupCenter);
            const desired = newGroupCenter.add(rel);
            const newFace = findClosestFace(desired);

            if (newFace !== null) {
                previewMapping[newFace] = moveOriginalState[faceIdx];
                previewSelected.add(newFace);
            }
        }

        // Remove old positions, add new ones
        for (const faceIdx of moveOriginalSelected) {
            delete newFaceColorsPreview[faceIdx];
        }
        Object.assign(newFaceColorsPreview, previewMapping);

        faceColors = newFaceColorsPreview; // Apply preview to actual faceColors
        selectedFaces = previewSelected; // Apply preview to actual selectedFaces
    }
    requestRedraw();
}

/**
 * Commits the current move operation, resetting temporary states.
 */
function commitMovePreview() {
    isMovingSelection = false;
    moveStartPos = null;
    moveDelta = new Point(0, 0);
    moveOriginalState = {};
    moveOriginalSelected = new Set();
    onProjectModified(); // Mark the project as modified after a move operation
    requestRedraw();
}

/**
 * Updates the rotation of selected points/faces based on current pointer position.
 * Used for real-time visual feedback during a rotate operation.
 */
function updateRotatePreview() {
    if (!rotateOriginalSelected || rotateOriginalSelected.size === 0) return;

    const T = computeTransform();
    const [invT, ok] = T.inverted();
    if (!ok) return;

    let groupCenter = new Point(0, 0);
    let count = 0;

    if (movePoints) {
        for (const key of rotateOriginalSelected) {
            groupCenter = groupCenter.add(movePoints[key].pos);
            count++;
        }
    } else {
        for (const faceIdx of rotateOriginalSelected) {
            groupCenter = groupCenter.add(getFaceCenter(faceIdx));
            count++;
        }
    }

    if (count > 0) {
        groupCenter = new Point(groupCenter.x / count, groupCenter.y / count);
    } else {
        return;
    }

    const startModel = invT.map(rotateStartPos);
    const currentModel = invT.map(rotateCurrentPos);

    const vecStart = startModel.subtract(groupCenter);
    const vecCurrent = currentModel.subtract(groupCenter);

    const angleStart = Math.atan2(vecStart.y, vecStart.x);
    const angleCurrent = Math.atan2(vecCurrent.y, vecCurrent.x);
    const angleDelta = angleCurrent - angleStart;

    if (movePoints) {
        for (const key of rotateOriginalSelected) {
            const orig = rotateOriginalState[key];
            const rel = orig.subtract(groupCenter);
            const cosA = Math.cos(angleDelta);
            const sinA = Math.sin(angleDelta);
            const rotated = new Point(
                rel.x * cosA - rel.y * sinA,
                rel.x * sinA + rel.y * cosA
            );
            movePoints[key].pos = groupCenter.add(rotated);
        }
        selectedPoints = new Set(rotateOriginalSelected); // Ensure selected points remain selected during rotation
    } else {
        const newFaceColorsPreview = { ...rotateOriginalState };
        const previewMapping = {};
        const previewSelected = new Set();

        for (const faceIdx of rotateOriginalSelected) {
            const originalCenter = getFaceCenter(faceIdx);
            const rel = originalCenter.subtract(groupCenter);
            const cosA = Math.cos(angleDelta);
            const sinA = Math.sin(angleDelta);
            const rotated = new Point(
                rel.x * cosA - rel.y * sinA,
                rel.x * sinA + rel.y * cosA
            );
            const desired = groupCenter.add(rotated);
            const newFace = findClosestFace(desired);

            if (newFace !== null) {
                previewMapping[newFace] = rotateOriginalState[faceIdx];
                previewSelected.add(newFace);
            }
        }

        // Remove old positions, add new ones
        for (const faceIdx of rotateOriginalSelected) {
            delete newFaceColorsPreview[faceIdx];
        }
        Object.assign(newFaceColorsPreview, previewMapping);

        faceColors = newFaceColorsPreview;
        selectedFaces = previewSelected;
    }
    requestRedraw();
}

/**
 * Commits the current rotate operation, resetting temporary states.
 */
function commitRotatePreview() {
    isRotatingSelection = false;
    rotateStartPos = null;
    rotateCurrentPos = null;
    rotateOriginalState = {};
    rotateOriginalSelected = new Set();
    onProjectModified(); // Mark the project as modified after a rotate operation
    requestRedraw();
}

// Unified event handler for mouse and touch start
function handlePointerDown(event) {
    // Prevent default touch actions like scrolling/zooming
    if (event.type.startsWith('touch')) {
        event.preventDefault();
    }

    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX || (event.touches[0] ? event.touches[0].clientX : 0);
    const clientY = event.clientY || (event.touches[0] ? event.touches[0].clientY : 0);
    const pos = new Point(clientX - rect.left, clientY - rect.top);

    // Handle multi-touch (pinch-to-zoom)
    if (event.touches && event.touches.length === 2) {
        isPinching = true;
        initialPinchDistance = pos.distanceTo(new Point(event.touches[1].clientX - rect.left, event.touches[1].clientY - rect.top));
        initialPinchMidpoint = new Point(
            ((event.touches[0].clientX + event.touches[1].clientX) / 2) - rect.left,
            ((event.touches[0].clientY + event.touches[1].clientY) / 2) - rect.top
        );
        initialZoom = zoom;
        initialPanOffset = new Point(panOffset.x, panOffset.y);
        return;
    }

    // Prioritize middle mouse button for pan
    if (event.button === 1) { // Middle mouse button
        middleMouseDown = true;
        lastPanPoint = pos;
        canvas.style.cursor = 'grab';
        return;
    }

    // Tool actions (left click or single touch for paint/erase)
    if (currentTool === 'paint' || currentTool === 'erase') {
        const effectiveTool = event.button === 0 || (event.type === 'touchstart' && event.touches.length === 1) ? currentTool : (currentTool === 'paint' ? 'erase' : 'paint');
        if (!strokeInProgress) {
            pushUndoState();
            strokeInProgress = true;
        }
        isPainting = true;
        activePaintTool = effectiveTool;
        paintAt(pos, effectiveTool);
        return;
    }

    if (currentTool === 'move') {
        const selectionRect = getSelectionBoundingRect();
        let clickedOnGizmo = false;
        if (selectionRect) {
            const handleCenter = selectionRect.topRight;
            const handleRadius = 15; // Radius for the rotation gizmo
            const distToHandle = handleCenter.distanceTo(pos);
            if (distToHandle <= handleRadius) {
                clickedOnGizmo = true;
            }
        }

        if (clickedOnGizmo) {
            pushUndoState();
            isRotatingSelection = true;
            rotateStartPos = pos;
            rotateCurrentPos = pos;
            if (movePoints) {
                rotateOriginalState = Object.fromEntries(
                    Array.from(selectedPoints).map(key => [key, movePoints[key].pos])
                );
                rotateOriginalSelected = new Set(selectedPoints);
            } else {
                rotateOriginalState = { ...faceColors };
                rotateOriginalSelected = new Set(selectedFaces);
            }
        } else if (selectionRect && selectionRect.contains(pos)) {
            pushUndoState();
            isMovingSelection = true;
            moveStartPos = pos;
            moveDelta = new Point(0, 0);
            if (movePoints) {
                moveOriginalState = Object.fromEntries(
                    Array.from(selectedPoints).map(key => [key, movePoints[key].pos])
                );
                moveOriginalSelected = new Set(selectedPoints);
            } else {
                moveOriginalState = { ...faceColors };
                moveOriginalSelected = new Set(selectedFaces);
            }
        } else { // Start selection or pan canvas if no selection/gizmo clicked
            isSelecting = true;
            selectStart = pos;
            selectRect = new Rect(pos.x, pos.y, 0, 0);
            selectModifiers = (event.ctrlKey || event.metaKey) ? 1 : 0; // 1 for add/remove from selection
            if (movePoints) {
                if (!selectModifiers) {
                    selectedPoints = new Set(); // Clear selection if no modifier
                }
            } else {
                if (!selectModifiers) {
                    selectedFaces = new Set(); // Clear selection if no modifier
                }
            }
        }
        requestRedraw();
        return;
    }

    // Default left-click/single-touch pan for canvas if no specific tool action is taken
    if (event.button === 0 || (event.type === 'touchstart' && event.touches.length === 1)) {
        isPanningCanvas = true;
        lastPanPoint = pos;
        canvas.style.cursor = 'grab';
        return;
    }
}

// Unified event handler for mouse and touch move
function handlePointerMove(event) {
    // Prevent default touch actions like scrolling/zooming
    if (event.type.startsWith('touch')) {
        event.preventDefault();
    }

    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX || (event.touches[0] ? event.touches[0].clientX : 0);
    const clientY = event.clientY || (event.touches[0] ? event.touches[0].clientY : 0);
    const pos = new Point(clientX - rect.left, clientY - rect.top);

    // Handle pinch-to-zoom
    if (isPinching && event.touches && event.touches.length === 2) {
        const currentPinchDistance = pos.distanceTo(new Point(event.touches[1].clientX - rect.left, event.touches[1].clientY - rect.top));
        const currentPinchMidpoint = new Point(
            ((event.touches[0].clientX + event.touches[1].clientX) / 2) - rect.left,
            ((event.touches[0].clientY + event.touches[1].clientY) / 2) - rect.top
        );

        const scaleFactor = currentPinchDistance / initialPinchDistance;
        zoom = initialZoom * scaleFactor;

        // Adjust pan offset to zoom around the midpoint
        panOffset.x = initialPanOffset.x + (currentPinchMidpoint.x - initialPinchMidpoint.x) - (initialPinchMidpoint.x - initialPanOffset.x) * (scaleFactor - 1);
        panOffset.y = initialPanOffset.y + (currentPinchMidpoint.y - initialPinchMidpoint.y) - (initialPinchMidpoint.y - initialPanOffset.y) * (scaleFactor - 1);

        requestRedraw();
        return;
    }


    if (middleMouseDown || isPanningCanvas) {
        const delta = pos.subtract(lastPanPoint);
        panOffset = panOffset.add(delta);
        lastPanPoint = pos;
        requestRedraw();
        return;
    }

    if (isPainting) {
        paintAt(pos, activePaintTool);
        return;
    }

    if (currentTool === 'move') {
        if (isRotatingSelection) {
            rotateCurrentPos = pos;
            updateRotatePreview();
        } else if (isMovingSelection) {
            moveDelta = pos.subtract(moveStartPos);
            updateMovePreview();
        } else if (isSelecting) {
            selectRect = new Rect(selectStart.x, selectStart.y, pos.x - selectStart.x, pos.y - selectStart.y);
            requestRedraw();
        }
        return;
    }
}

// Unified event handler for mouse and touch end/cancel
function handlePointerUp(event) {
    // Check for touchcancel to ensure state is reset
    if (event.type === 'touchcancel') {
        isPainting = false;
        strokeInProgress = false;
        isSelecting = false;
        isMovingSelection = false;
        isRotatingSelection = false;
        middleMouseDown = false;
        isPanningCanvas = false;
        isPinching = false; // Reset pinch state
        canvas.style.cursor = 'default';
        requestRedraw(); // Request redraw to clear any partial states
        return;
    }

    // Only reset pinch state if all touches are lifted
    if (isPinching && event.touches && event.touches.length === 0) {
        isPinching = false;
    }

    if (event.button === 1 || (event.type === 'touchend' && !event.touches.length && middleMouseDown)) { // Middle mouse button or end of 2-finger touch
        middleMouseDown = false;
        canvas.style.cursor = 'default';
    }

    if (isPanningCanvas) { // Left mouse button pan or single-touch pan
        isPanningCanvas = false;
        canvas.style.cursor = 'default';
    }

    if (currentTool === 'paint' || currentTool === 'erase') {
        if (isPainting && (event.button === 0 || event.button === 2 || event.type === 'touchend')) {
            isPainting = false;
            strokeInProgress = false;
        }
        return;
    }

    if (currentTool === 'move') {
        if (isRotatingSelection) {
            commitRotatePreview();
        } else if (isMovingSelection) {
            commitMovePreview();
        } else if (isSelecting) {
            const normalizedRect = selectRect.normalized();
            if (normalizedRect.width < 5 && normalizedRect.height < 5) { // Single click
                if (movePoints) {
                    const clientX = event.clientX || (event.changedTouches[0] ? event.changedTouches[0].clientX : 0);
                    const clientY = event.clientY || (event.changedTouches[0] ? event.changedTouches[0].clientY : 0);
                    const rect = canvas.getBoundingClientRect();
                    const pos = new Point(clientX - rect.left, clientY - rect.top);
                    const pointKey = pointAt(pos);
                    if (pointKey !== null) {
                        if (selectModifiers) {
                            if (selectedPoints.has(pointKey)) {
                                selectedPoints.delete(pointKey);
                            } else {
                                selectedPoints.add(pointKey);
                            }
                        } else {
                            selectedPoints = new Set([pointKey]);
                        }
                    } else if (!selectModifiers) {
                        selectedPoints = new Set();
                    }
                } else {
                    const T = computeTransform();
                    const [invT, ok] = T.inverted();
                    if (!ok) return;
                    const clientX = event.clientX || (event.changedTouches[0] ? event.changedTouches[0].clientX : 0);
                    const clientY = event.clientY || (event.changedTouches[0] ? event.changedTouches[0].clientY : 0);
                    const rect = canvas.getBoundingClientRect();
                    const modelPos = invT.map(new Point(clientX - rect.left, clientY - rect.top));

                    let clickedFace = null;
                    for (let i = cachedFacePolygons.length - 1; i >= 0; i--) {
                        const poly = cachedFacePolygons[i];
                        if (isPointInPolygon(modelPos, poly)) {
                            clickedFace = i;
                            break;
                        }
                    }

                    if (clickedFace !== null) {
                        if (selectModifiers) {
                            if (selectedFaces.has(clickedFace)) {
                                selectedFaces.delete(clickedFace);
                            } else {
                                selectedFaces.add(clickedFace);
                            }
                        } else {
                            selectedFaces = new Set([clickedFace]);
                        }
                    } else if (!selectModifiers) {
                        selectedFaces = new Set();
                    }
                }
            } else { // Marquee select
                const T = computeTransform();
                if (movePoints) {
                    const newSelected = selectModifiers ? new Set(selectedPoints) : new Set();
                    for (const keyStr in movePoints) {
                        const key = parseInt(keyStr);
                        const data = movePoints[key];
                        const ptWidget = T.map(data.pos);
                        if (normalizedRect.contains(ptWidget.toIntegerPoint())) {
                            newSelected.add(key);
                        }
                    }
                    selectedPoints = newSelected;
                } else {
                    const newSelected = selectModifiers ? new Set(selectedFaces) : new Set();
                    // Iterate over ALL faces to select them, not just painted ones
                    for (let i = 0; i < faces.length; i++) {
                        const centerModel = getFaceCenter(i);
                        const centerWidget = T.map(centerModel);
                        if (normalizedRect.contains(centerWidget.toIntegerPoint())) {
                            newSelected.add(i);
                        }
                    }
                    selectedFaces = newSelected;
                }
            }
            isSelecting = false;
            selectRect = null;
            selectStart = null;
            selectModifiers = 0;
            requestRedraw();
        }
        return;
    }
}

/**
 * Handles mouse wheel events for zooming the canvas.
 * @param {WheelEvent} event - The wheel event.
 */
function handleWheel(event) {
    event.preventDefault(); // Prevent page scrolling

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Calculate mouse position in the current "viewport" coordinates (after base transform, before user pan/zoom)
    // screen_x = (model_x_after_base * zoom) + panOffset.x
    // screen_y = (model_y_after_base * zoom) + panOffset.y
    const modelX = (mouseX - panOffset.x) / zoom;
    const modelY = (mouseY - panOffset.y) / zoom;

    const factor = event.deltaY > 0 ? 0.9 : 1.1; // Adjust zoom speed here
    zoom *= factor;

    // Update panOffset to keep the model point under the mouse cursor
    panOffset.x = mouseX - (modelX * zoom);
    panOffset.y = mouseY - (modelY * zoom);

    requestRedraw();
}

/**
 * Draws all elements on the canvas, including OBJ faces, painted colors, selection outlines, and gizmos.
 */
function draw() {
    if (!canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the entire canvas

    ctx.fillStyle = '#ECEFF1'; // Canvas background color
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (vertices.length === 0 || faces.length === 0) {
        // Display placeholder text if no OBJ is loaded
        ctx.fillStyle = '#607D8B';
        ctx.font = '20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(translations[currentLanguage].canvasPlaceholder, canvas.width / 2, canvas.height / 2);
        return;
    }

    const T = computeTransform();
    ctx.save();
    ctx.transform(T.m11, T.m12, T.m21, T.m22, T.dx, T.dy);

    if (currentTool === 'move' && movePoints !== null) {
        // Draw all faces as outlines when in 'move' mode
        for (let i = 0; i < faces.length; i++) {
            const path = cachedFacePaths[i];
            ctx.fillStyle = 'white'; // Default fill for faces in move mode
            ctx.fill(path);
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1 / T.m11; // Fixed 1px width on screen regardless of zoom
            ctx.stroke(path);
        }
        ctx.restore(); // Restore context to draw points at fixed screen size

        // Draw move points
        for (const keyStr in movePoints) {
            const key = parseInt(keyStr);
            const data = movePoints[key];
            const ptWidget = T.map(data.pos); // Point's position in canvas coordinates
            const radius = 5; // Fixed size for the point widget
            ctx.beginPath();
            ctx.arc(ptWidget.x, ptWidget.y, radius, 0, 2 * Math.PI);
            ctx.fillStyle = data.color;
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2; // Fixed stroke for points
            ctx.stroke();

            // Draw selection outline for selected points
            if (selectedPoints.has(key)) {
                ctx.strokeStyle = 'blue';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]); // Dashed outline
                ctx.stroke();
                ctx.setLineDash([]); // Reset line dash
            }
        }
    } else {
        // Draw faces with their assigned colors when not in 'move' mode
        for (let i = 0; i < faces.length; i++) {
            const path = cachedFacePaths[i];
            ctx.fillStyle = faceColors[i] || 'white'; // Use assigned color or default white
            ctx.fill(path);
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1 / T.m11; // Fixed 1px width on screen regardless of zoom
            ctx.stroke(path);

            // Draw selection outline for selected faces
            if (selectedFaces.has(i)) {
                ctx.strokeStyle = 'blue';
                ctx.lineWidth = 0.5 / T.m11; // Thinner dashed line
                ctx.setLineDash([5 / T.m11, 5 / T.m11]); // Dashed outline
                ctx.stroke(path);
                ctx.setLineDash([]); // Reset line dash
            }
        }
        ctx.restore(); // Restore context after drawing transformed faces
    }

    // Draw selection rectangle for marquee selection
    if (currentTool === 'move' && isSelecting && selectRect) {
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        const normalizedRect = selectRect.normalized();
        ctx.strokeRect(normalizedRect.x, normalizedRect.y, normalizedRect.width, normalizedRect.height);
        ctx.setLineDash([]);
    } else if (currentTool === 'move' && movePoints !== null && selectedPoints.size > 0) {
        // Draw bounding box and rotation gizmo for selected points in 'move' mode
        const rect = getSelectionBoundingRect();
        if (rect) {
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            ctx.setLineDash([]);

            // Draw rotation gizmo (handle at top-right of selection bounding box)
            const handleCenter = rect.topRight;
            const handleRadius = 15;
            ctx.beginPath();
            ctx.arc(handleCenter.x, handleCenter.y, handleRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    } else if (selectedFaces.size > 0 && currentTool !== 'move') {
        // Draw bounding box for selected faces in paint/erase mode
        const rect = getSelectionBoundingRect();
        if (rect) {
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            ctx.setLineDash([]);
        }
    }
}

// --- File Operations ---
// Event listener for the Load OBJ button to trigger the hidden input
loadObjButton.addEventListener('click', () => {
    loadObjInput.click();
});

loadObjInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (isModified) {
        showMessageBox(translations[currentLanguage].unsavedChangesTitle, translations[currentLanguage].unsavedChangesMessage, 'question', true)
            .then(({ confirmed }) => {
                if (confirmed) {
                    saveProject(true, () => { // Pass true to force save-as behavior for initial save
                        const reader = new FileReader();
                        reader.onload = (e) => loadObjFileContent(e.target.result);
                        reader.readAsText(file);
                    });
                } else {
                    const reader = new FileReader();
                    reader.onload = (e) => loadObjFileContent(e.target.result);
                    reader.readAsText(file);
                }
            });
    } else {
        const reader = new FileReader();
        reader.onload = (e) => loadObjFileContent(e.target.result);
        reader.readAsText(file);
    }
    // Clear the input's value to allow loading the same file again if needed
    event.target.value = '';
});

// Event listener for the Open Project button to trigger the hidden input
openProjectButton.addEventListener('click', () => {
    openProjectInput.click();
});

openProjectInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const loadFileContent = (fileToLoad) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                vertices = data.vertices || [];
                faces = data.faces || [];
                const loadedFaceColors = {};
                for (const key in data.faceColors) {
                    loadedFaceColors[parseInt(key)] = data.faceColors[key];
                }
                faceColors = loadedFaceColors;
                selectedFaces = new Set(data.selectedFaces || []);
                zoom = data.zoom || 1.0;
                const pan = data.panOffset || [0, 0];
                panOffset = new Point(pan[0], pan[1]);
                undoStack = [];
                redoStack = [];
                movePoints = null;
                selectedPoints = new Set();
                currentFilePath = fileToLoad.name;
                isModified = false;
                computeFaceCenters();
                cacheFacePolygons();
                requestRedraw();
                updateTitle();
                showMessageBox(translations[currentLanguage].successTitle, translations[currentLanguage].projectLoadedMessage, 'info');
            } catch (error) {
                showMessageBox(translations[currentLanguage].errorTitle, `${translations[currentLanguage].projectLoadErrorMessage}: ${error.message}`, 'error');
            }
        };
        reader.readAsText(fileToLoad);
    };

    if (isModified) {
        showMessageBox(translations[currentLanguage].unsavedChangesTitle, translations[currentLanguage].unsavedChangesMessage, 'question', true)
            .then(({ confirmed }) => {
                if (confirmed) {
                    saveProject(true, () => loadFileContent(file)); // Pass true to force save-as behavior
                } else {
                    loadFileContent(file);
                }
            });
    } else {
        loadFileContent(file);
    }
    // Clear the input's value to allow loading the same file again if needed
    event.target.value = '';
});

/**
 * Saves the current project state to a .kufi file.
 * @param {boolean} forceSaveAs - If true, always prompts for a new filename.
 * @param {function} [callback] - An optional callback function to execute after saving.
 */
async function saveProject(forceSaveAs = false, callback = () => { }) {
    if (vertices.length === 0) {
        showMessageBox(translations[currentLanguage].noContentMessage, translations[currentLanguage].noContentMessage, 'info');
        return;
    }

    let filename = currentFilePath;

    if (forceSaveAs || !currentFilePath) {
        const defaultName = currentFilePath ? currentFilePath.replace(/\.kufi$/, '') : 'untitled';
        const result = await showSaveDialog(translations[currentLanguage].saveProjectAs, defaultName, '.kufi');
        if (result) {
            filename = result;
            currentFilePath = filename; // Update currentFilePath for future saves
        } else {
            showMessageBox(translations[currentLanguage].saveCancelledMessage, translations[currentLanguage].saveCancelledMessage, 'info');
            callback(); // Still call callback even if cancelled, if it's part of a larger flow
            return;
        }
    }

    const projectData = {
        vertices: vertices,
        faces: faces,
        faceColors: faceColors,
        selectedFaces: Array.from(selectedFaces), // Convert Set to Array for JSON serialization
        zoom: zoom,
        panOffset: [panOffset.x, panOffset.y],
    };

    const dataStr = JSON.stringify(projectData);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    isModified = false;
    updateTitle();
    showMessageBox(translations[currentLanguage].successTitle, translations[currentLanguage].projectSavedMessage(filename), 'info');
    callback();
}
saveProjectBtn.addEventListener('click', () => saveProject());

/**
 * Prompts the user to save the project with a new filename.
 */
async function saveProjectAs() {
    await saveProject(true); // Force save-as behavior
}
saveProjectAsBtn.addEventListener('click', saveProjectAs);

/**
 * Exports the current canvas content as an SVG file.
 */
async function exportSVG() {
    if (vertices.length === 0) {
        showMessageBox(translations[currentLanguage].noContentMessage, translations[currentLanguage].noContentMessage, 'info');
        return;
    }

    const defaultName = currentFilePath ? currentFilePath.replace(/\.kufi$/, '.svg') : 'exported.svg';
    const filename = await showSaveDialog(translations[currentLanguage].exportSvg, defaultName, '.svg');

    if (!filename) {
        showMessageBox(translations[currentLanguage].exportCancelledMessage('SVG'), translations[currentLanguage].exportCancelledMessage('SVG'), 'info');
        return;
    }

    const { min_x, max_x, min_z, max_z } = boundingBox();
    const modelWidth = max_x - min_x;
    const modelHeight = max_z - min_z;

    const svg_width = canvas.width;
    const svg_height = canvas.height;

    let s = 1.0;
    const margin = 20;
    if (modelWidth > 0 && modelHeight > 0) {
        s = Math.min((svg_width - 2 * margin) / modelWidth, (svg_height - 2 * margin) / modelHeight);
    }

    let svgContent = `<?xml version="1.0" encoding="UTF-8" ?>\n`;
    svgContent += `<svg xmlns="http://www.w3.org/2000/svg" width="${svg_width}" height="${svg_height}" version="1.1">\n`;
    svgContent += `<rect width="100%" height="100%" fill="#ECEFF1"/>\n`;

    const baseTransform = new Transform(s, 0, 0, -s, margin - s * min_x, margin + s * max_z);
    const fullTransform = new Transform()
        .scale(zoom, zoom)
        .translate(panOffset.x, panOffset.y)
        .times(baseTransform);

    for (let i = 0; i < faces.length; i++) {
        const face = faces[i];
        if (!face || face.length === 0) continue;

        const points = [];
        for (const idx of face) {
            if (idx >= 0 && idx < vertices.length) {
                const v = vertices[idx];
                const transformedPoint = fullTransform.map(new Point(v[0], v[2]));
                points.push(`${transformedPoint.x},${transformedPoint.y}`);
            }
        }
        if (points.length === 0) continue;

        const pointsStr = points.join(" ");
        const fill = faceColors[i] || 'white';
        svgContent += `<polygon points="${pointsStr}" fill="${fill}" stroke="black" stroke-width="0.5"/>\n`;
    }
    svgContent += `</svg>\n`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMessageBox(translations[currentLanguage].successTitle, translations[currentLanguage].svgExportSuccessMessage(filename), 'info');
}
exportSvgBtn.addEventListener('click', exportSVG);

/**
 * Handles the PNG export process, including prompting for resolution.
 */
async function handleExportPng() {
    if (vertices.length === 0) {
        showMessageBox(translations[currentLanguage].noContentMessage, translations[currentLanguage].noContentMessage, 'info');
        return;
    }
    const confirmedResolution = await showModal(translations[currentLanguage].exportResolutionTitle, `
        <div class="space-y-4">
            <div>
                <label for="export-width" class="block text-gray-700 text-sm font-bold mb-2">Width:</label>
                <input id="export-width" type="number" min="100" max="10000" value="${exportResolution.width}"
                       class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
            </div>
            <div>
                <label for="export-height" class="block text-gray-700 text-sm font-bold mb-2">Height:</label>
                <input id="export-height" type="number" min="100" max="10000" value="${exportResolution.height}"
                       class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline">
            </div>
        </div>
    `, true);

    if (confirmedResolution) {
        const widthInput = document.getElementById('export-width');
        const heightInput = document.getElementById('export-height');
        exportResolution.width = parseInt(widthInput.value);
        exportResolution.height = parseInt(heightInput.value);
        await confirmExportPng();
    } else {
        showMessageBox(translations[currentLanguage].exportCancelledMessage('PNG'), translations[currentLanguage].exportCancelledMessage('PNG'), 'info');
    }
}
exportPngBtn.addEventListener('click', handleExportPng);

/**
 * Confirms the PNG export and performs the rendering and download.
 */
async function confirmExportPng() {
    const defaultName = currentFilePath ? currentFilePath.replace(/\.kufi$/, '.png') : 'exported.png';
    const filename = await showSaveDialog(translations[currentLanguage].exportPng, defaultName, '.png');

    if (!filename) {
        showMessageBox(translations[currentLanguage].exportCancelledMessage('PNG'), translations[currentLanguage].exportCancelledMessage('PNG'), 'info');
        return;
    }

    const { width: userWidth, height: userHeight } = exportResolution;

    const { min_x, max_x, min_z, max_z } = boundingBox();
    const modelWidth = max_x - min_x;
    const modelHeight = max_z - min_z;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = userWidth;
    exportCanvas.height = userHeight;
    const ctxExport = exportCanvas.getContext('2d');

    ctxExport.fillStyle = '#ECEFF1';
    ctxExport.fillRect(0, 0, userWidth, userHeight);

    let s = 1.0;
    const margin = 20;
    if (modelWidth > 0 && modelHeight > 0) {
        s = Math.min(
            (userWidth - 2 * margin) / modelWidth,
            (userHeight - 2 * margin) / modelHeight
        );
    }

    const center_model_x = (min_x + max_x) / 2;
    const center_model_z = (min_z + max_z) / 2;
    const tx = userWidth / 2 - s * center_model_x;
    const ty = userHeight / 2 + s * center_model_z;

    const exportTransform = new Transform(s, 0, 0, -s, tx, ty);

    ctxExport.save();
    ctxExport.transform(exportTransform.m11, exportTransform.m12, exportTransform.m21, exportTransform.m22, exportTransform.dx, exportTransform.dy);

    for (let i = 0; i < faces.length; i++) {
        const path = cachedFacePaths[i];
        ctxExport.fillStyle = faceColors[i] || 'white';
        ctxExport.fill(path);
        ctxExport.strokeStyle = 'black';
        ctxExport.lineWidth = 1 / exportTransform.m11; // Ensures consistent line width in exported image
        ctxExport.stroke(path);

        if (selectedFaces.has(i)) {
            ctxExport.strokeStyle = 'blue';
            ctxExport.lineWidth = 0.5 / exportTransform.m11;
            ctxExport.setLineDash([5 / exportTransform.m11, 5 / exportTransform.m11]);
            ctxExport.stroke(path);
            ctxExport.setLineDash([]);
        }
    }
    ctxExport.restore();

    const dataURL = exportCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showMessageBox(translations[currentLanguage].successTitle, translations[currentLanguage].pngExportSuccessMessage(filename), 'info');
}

/**
 * Clears all painted faces from the canvas.
 */
function clearCanvas() {
    if (vertices.length === 0) {
        showMessageBox(translations[currentLanguage].noContentMessage, translations[currentLanguage].canvasAlreadyEmpty, 'info');
        return;
    }
    showMessageBox(translations[currentLanguage].clearCanvasTitle, translations[currentLanguage].clearCanvasMessage, 'question', true)
        .then(({ confirmed }) => {
            if (confirmed) {
                pushUndoState(); // Save state before clearing
                faceColors = {};
                selectedFaces = new Set();
                movePoints = null; // Clear move points as well
                selectedPoints = new Set();
                isModified = true;
                updateTitle();
                requestRedraw();
                showMessageBox(translations[currentLanguage].successTitle, translations[currentLanguage].canvasClearedMessage, 'info');
            }
        });
}
clearCanvasBtn.addEventListener('click', clearCanvas);

// --- Event Listeners ---
// Unified pointer events for mouse and touch
canvas.addEventListener('mousedown', handlePointerDown);
canvas.addEventListener('mousemove', handlePointerMove);
canvas.addEventListener('mouseup', handlePointerUp);
canvas.addEventListener('touchstart', handlePointerDown, { passive: false }); // passive: false to allow preventDefault
canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
canvas.addEventListener('touchend', handlePointerUp);
canvas.addEventListener('touchcancel', handlePointerUp); // Handle touch cancellation
canvas.addEventListener('contextmenu', (event) => event.preventDefault()); // Disable right-click context menu

canvas.addEventListener('wheel', handleWheel, { passive: false }); // Use passive: false for preventDefault on wheel

// Tool buttons
toolPaintBtn.addEventListener('click', () => switchTool('paint'));
toolEraseBtn.addEventListener('click', () => switchTool('erase'));
toolMoveBtn.addEventListener('click', () => switchTool('move'));

// Color palette buttons
const colors = [
    { name: 'Black', color: 'rgba(60, 60, 60, 1)' },
    // { name: 'White', color: 'rgba(240, 240, 240, 1)' }, // Removed to prevent confusion with default face color
    { name: 'Red', color: 'rgba(255, 104, 104, 1)' },
    { name: 'Green', color: 'rgba(96, 160, 96, 1)' },
    { name: 'Blue', color: 'rgba(104, 136, 200, 1)' },
    { name: 'Yellow', color: 'rgba(255, 255, 100, 1)' },
    { name: 'Cyan', color: 'rgba(100, 255, 255, 1)' },
    { name: 'Magenta', color: 'rgba(255, 100, 255, 1)' },
    { name: 'Orange', color: 'rgba(255, 165, 0, 1)' },
    { name: 'Purple', color: 'rgba(128, 0, 128, 1)' },
    { name: 'Brown', color: 'rgba(139, 69, 19, 1)' },
    // { name: 'Gray', color: 'rgba(128, 128, 128, 1)' }, // Removed
];

colors.forEach((col, index) => {
    const button = document.createElement('button');
    button.textContent = translations[currentLanguage][`color${col.name}`]; // Set initial translated text
    button.className = `flex flex-col items-center justify-center p-2 rounded-md transition duration-200 text-white text-sm`;
    button.style.backgroundColor = col.color;
    // Adjust text color for light backgrounds
    if (['White', 'Yellow', 'Cyan'].includes(col.name)) {
        button.style.color = 'rgba(60, 60, 60, 1)'; // Darker text for light colors
    }
    if (col.name === 'Red') { // Default selected color
        button.classList.add('border-2', 'border-yellow-400');
        fillColor = col.color;
    } else {
        button.classList.add('border-2', 'border-transparent', 'hover:border-gray-600');
    }
    button.addEventListener('click', () => {
        fillColor = col.color;
        document.querySelectorAll('#color-palette button').forEach(btn => {
            btn.classList.remove('border-2', 'border-yellow-400');
            btn.classList.add('border-2', 'border-transparent', 'hover:border-gray-600');
        });
        button.classList.add('border-2', 'border-yellow-400');
        button.classList.remove('border-transparent', 'hover:border-gray-600');
    });
    colorPalette.appendChild(button);
});

// Undo/Redo buttons
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

// Keyboard shortcuts
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey) { // Ctrl for Windows/Linux, Cmd for macOS
        switch (event.key.toLowerCase()) {
            case 'o':
                event.preventDefault(); // Prevent browser's open dialog
                openProjectInput.click();
                break;
            case 's':
                event.preventDefault(); // Prevent browser's save dialog
                if (event.shiftKey) {
                    saveProjectAs();
                } else {
                    saveProject();
                }
                break;
            case 'e':
                event.preventDefault(); // Prevent default behavior (e.g., in some browsers)
                if (event.shiftKey) {
                    handleExportPng();
                } else {
                    exportSVG();
                }
                break;
            case 'l':
                event.preventDefault(); // Prevent default behavior
                loadObjInput.click();
                break;
            case 'r':
                event.preventDefault(); // Prevent default behavior
                clearCanvas();
                break;
            case 'z':
                event.preventDefault(); // Prevent browser's undo
                undo();
                break;
            case 'y':
                event.preventDefault(); // Prevent browser's redo
                redo();
                break;
            default:
                break;
        }
    }
});

// Canvas resize observer
const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
        requestRedraw();
    }
});
resizeObserver.observe(canvas.parentElement);

// --- Drag and Drop functionality ---
document.body.addEventListener('dragover', (event) => {
    event.preventDefault(); // Prevent default to allow drop
    event.stopPropagation();
    document.body.classList.add('bg-blue-300'); // Optional: visual feedback
});

document.body.addEventListener('dragleave', (event) => {
    event.preventDefault();
    event.stopPropagation();
    document.body.classList.remove('bg-blue-300'); // Optional: visual feedback
});

document.body.addEventListener('drop', (event) => {
    event.preventDefault(); // Prevent default file opening
    event.stopPropagation();
    document.body.classList.remove('bg-blue-300'); // Optional: visual feedback

    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        const fileName = file.name.toLowerCase();

        const processFile = (fileToProcess) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (fileName.endsWith('.obj')) {
                    loadObjFileContent(e.target.result);
                } else if (fileName.endsWith('.kufi')) {
                    try {
                        const data = JSON.parse(e.target.result);
                        vertices = data.vertices || [];
                        faces = data.faces || [];
                        const loadedFaceColors = {};
                        for (const key in data.faceColors) {
                            loadedFaceColors[parseInt(key)] = data.faceColors[key];
                        }
                        faceColors = loadedFaceColors;
                        selectedFaces = new Set(data.selectedFaces || []);
                        zoom = data.zoom || 1.0;
                        const pan = data.panOffset || [0, 0];
                        panOffset = new Point(pan[0], pan[1]);
                        undoStack = [];
                        redoStack = [];
                        movePoints = null;
                        selectedPoints = new Set();
                        currentFilePath = fileToProcess.name;
                        isModified = false;
                        computeFaceCenters();
                        cacheFacePolygons();
                        requestRedraw();
                        updateTitle();
                        showMessageBox(translations[currentLanguage].successTitle, translations[currentLanguage].projectLoadedMessage, 'info');
                    } catch (error) {
                        showMessageBox(translations[currentLanguage].errorTitle, `${translations[currentLanguage].projectLoadErrorMessage}: ${error.message}`, 'error');
                    }
                } else {
                    showMessageBox(translations[currentLanguage].errorTitle, "Unsupported file type. Please drop .obj or .kufi files.", 'error');
                }
            };
            reader.readAsText(fileToProcess);
        };

        if (isModified) {
            showMessageBox(translations[currentLanguage].unsavedChangesTitle, translations[currentLanguage].unsavedChangesMessage, 'question', true)
                .then(({ confirmed }) => {
                    if (confirmed) {
                        saveProject(true, () => processFile(file));
                    } else {
                        processFile(file);
                    }
                });
        } else {
            processFile(file);
        }
    }
});


// Show instructions on first run
function showInstructionsIfNeeded() {
    const showInstructions = localStorage.getItem('show_instructions');
    if (showInstructions === null || showInstructions === 'true') {
        showMessageBox(
            translations[currentLanguage].usageInstructionsTitle,
            translations[currentLanguage].usageInstructionsMessage,
            'info',
            false,
            true, // showCheckbox
            translations[currentLanguage].dontShowAgain
        ).then(({ checkboxChecked }) => {
            localStorage.setItem('show_instructions', !checkboxChecked);
        });
    }
}

// Initial setup
window.onload = () => {
    // Add a span for the canvas placeholder text to be translatable
    const canvasPlaceholderSpan = document.createElement('span');
    canvasPlaceholderSpan.id = 'canvas-placeholder-text';
    canvasPlaceholderSpan.style.display = 'none'; // Hidden, only used for text content
    document.body.appendChild(canvasPlaceholderSpan);

    setLanguage(currentLanguage); // Set initial language and update UI
    requestRedraw(); // Initial draw
    showInstructionsIfNeeded();

    // Event listeners for language flags
    flagEn.addEventListener('click', () => setLanguage('en'));
    flagTr.addEventListener('click', () => setLanguage('tr'));
    flagAr.addEventListener('click', () => setLanguage('ar'));
};
