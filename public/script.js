// ============================================================
// STATE
// ============================================================
const state = {
    elements: [],           // {id, type, x, y, content, color, size, imageUrl, imageElement, width, height}
    selectedId: null,
    backgroundImage: null,
    nextId: 1,
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    dragElementId: null,
    isResizing: false,
    resizeStartX: 0,
    resizeStartY: 0,
    resizeElementId: null,
    resizeStartWidth: 0,
    resizeStartHeight: 0,
};

// ============================================================
// DOM REFERENCES
// ============================================================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const uploadImage = document.getElementById('uploadImage');
const textInput = document.getElementById('textInput');
const textColor = document.getElementById('textColor');
const textSize = document.getElementById('textSize');
const textSizeValue = document.getElementById('textSizeValue');
const addTextBtn = document.getElementById('addTextBtn');
const downloadBtn = document.getElementById('downloadBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const templateList = document.getElementById('templateList');
const layersList = document.getElementById('layersList');
const elementControls = document.getElementById('elementControls');
const uploadedImages = document.getElementById('uploadedImages');
const uploadStatus = document.getElementById('uploadStatus');

// ============================================================
// CANVAS DRAWING
// ============================================================
function drawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    if (state.backgroundImage) {
        ctx.drawImage(state.backgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Draw all elements
    state.elements.forEach(el => {
        if (el.type === 'text') {
            ctx.font = `${el.size}px Arial, sans-serif`;
            ctx.fillStyle = el.color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';

            // Text shadow for better visibility
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            ctx.fillText(el.content, el.x, el.y);
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

        } else if (el.type === 'image' && el.imageElement) {
            ctx.drawImage(el.imageElement, el.x, el.y, el.width || 200, el.height || 150);
        }
    });

    // Draw selection border and resize handles
    if (state.selectedId) {
        const el = state.elements.find(e => e.id === state.selectedId);
        if (el) {
            let bx, by, bw, bh;

            if (el.type === 'text') {
                ctx.font = `${el.size}px Arial, sans-serif`;
                const metrics = ctx.measureText(el.content);
                bx = el.x - 5;
                by = el.y - 5;
                bw = metrics.width + 10;
                bh = el.size + 10;
            } else {
                bx = el.x - 5;
                by = el.y - 5;
                bw = (el.width || 200) + 10;
                bh = (el.height || 150) + 10;
            }

            // Selection border
            ctx.strokeStyle = '#6c63ff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(bx, by, bw, bh);
            ctx.setLineDash([]);

            // Resize handles (4 corners)
            const handleSize = 8;
            const handles = [
                [bx, by],
                [bx + bw, by],
                [bx, by + bh],
                [bx + bw, by + bh]
            ];

            handles.forEach(([hx, hy]) => {
                ctx.fillStyle = '#6c63ff';
                ctx.fillRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(hx - handleSize/2, hy - handleSize/2, handleSize, handleSize);
            });

            // Move hint
            ctx.fillStyle = 'rgba(108, 99, 255, 0.8)';
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('↕ Drag to move', el.x + 50, el.y - 30);
        }
    }
}

// ============================================================
// GET ELEMENT BOUNDS
// ============================================================
function getElementBounds(el) {
    if (el.type === 'text') {
        ctx.font = `${el.size}px Arial, sans-serif`;
        const metrics = ctx.measureText(el.content);
        return {
            x: el.x,
            y: el.y,
            width: metrics.width,
            height: el.size
        };
    } else {
        return {
            x: el.x,
            y: el.y,
            width: el.width || 200,
            height: el.height || 150
        };
    }
}

// ============================================================
// CHECK IF POINT INSIDE ELEMENT
// ============================================================
function isPointInsideElement(el, px, py) {
    const bounds = getElementBounds(el);
    return px >= bounds.x && px <= bounds.x + bounds.width &&
        py >= bounds.y && py <= bounds.y + bounds.height;
}

// ============================================================
// CHECK IF POINT ON RESIZE HANDLE
// ============================================================
function isOnResizeHandle(el, px, py) {
    const bounds = getElementBounds(el);
    const handleSize = 12;
    const handles = [
        [bounds.x, bounds.y],
        [bounds.x + bounds.width, bounds.y],
        [bounds.x, bounds.y + bounds.height],
        [bounds.x + bounds.width, bounds.y + bounds.height]
    ];

    return handles.some(([hx, hy]) => {
        return px >= hx - handleSize/2 && px <= hx + handleSize/2 &&
            py >= hy - handleSize/2 && py <= hy + handleSize/2;
    });
}

// ============================================================
// GET ELEMENT AT POSITION (from top to bottom)
// ============================================================
function getElementAtPosition(px, py) {
    // Check from top (last added)
    for (let i = state.elements.length - 1; i >= 0; i--) {
        const el = state.elements[i];
        if (isPointInsideElement(el, px, py)) {
            return el;
        }
    }
    return null;
}

// ============================================================
// MOUSE EVENTS FOR DRAG & RESIZE
// ============================================================
let mouseDown = false;

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Check if clicking on selected element's resize handle
    if (state.selectedId) {
        const el = state.elements.find(el => el.id === state.selectedId);
        if (el && isOnResizeHandle(el, mouseX, mouseY)) {
            state.isResizing = true;
            state.resizeElementId = el.id;
            state.resizeStartX = mouseX;
            state.resizeStartY = mouseY;
            const bounds = getElementBounds(el);
            state.resizeStartWidth = bounds.width;
            state.resizeStartHeight = bounds.height;
            return;
        }
    }

    // Check if clicking on an element
    const clickedEl = getElementAtPosition(mouseX, mouseY);
    if (clickedEl) {
        state.selectedId = clickedEl.id;
        state.isDragging = true;
        state.dragElementId = clickedEl.id;
        state.dragOffsetX = mouseX - clickedEl.x;
        state.dragOffsetY = mouseY - clickedEl.y;
        updateLayersList();
        updateElementControls(clickedEl.id);
        drawCanvas();
    } else {
        state.selectedId = null;
        updateLayersList();
        drawCanvas();
        elementControls.innerHTML = '<p style="color:#888;font-size:12px;">Click on an element to edit</p>';
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Resize
    if (state.isResizing && state.resizeElementId) {
        const el = state.elements.find(el => el.id === state.resizeElementId);
        if (el) {
            const dx = mouseX - state.resizeStartX;
            const dy = mouseY - state.resizeStartY;
            const newWidth = Math.max(20, state.resizeStartWidth + dx);
            const newHeight = Math.max(20, state.resizeStartHeight + dy);

            if (el.type === 'text') {
                el.size = Math.max(10, Math.min(100, newWidth / 2));
            } else {
                el.width = newWidth;
                el.height = newHeight;
            }
            drawCanvas();
            updateLayersList();
        }
        return;
    }

    // Drag
    if (state.isDragging && state.dragElementId) {
        const el = state.elements.find(el => el.id === state.dragElementId);
        if (el) {
            el.x = Math.max(0, mouseX - state.dragOffsetX);
            el.y = Math.max(0, mouseY - state.dragOffsetY);
            drawCanvas();
        }
        return;
    }

    // Change cursor
    if (state.selectedId) {
        const el = state.elements.find(el => el.id === state.selectedId);
        if (el && isOnResizeHandle(el, mouseX, mouseY)) {
            canvas.style.cursor = 'nwse-resize';
            return;
        }
    }
    canvas.style.cursor = 'crosshair';
});

canvas.addEventListener('mouseup', () => {
    state.isDragging = false;
    state.dragElementId = null;
    state.isResizing = false;
    state.resizeElementId = null;
    canvas.style.cursor = 'crosshair';
});

canvas.addEventListener('mouseleave', () => {
    state.isDragging = false;
    state.dragElementId = null;
    state.isResizing = false;
    state.resizeElementId = null;
    canvas.style.cursor = 'crosshair';
});

// ============================================================
// LOAD TEMPLATES
// ============================================================
async function loadTemplates() {
    try {
        const response = await fetch('/api/templates');
        const data = await response.json();
        if (data.templates && data.templates.length > 0) {
            templateList.innerHTML = '';
            data.templates.forEach(url => {
                const img = document.createElement('img');
                img.src = url;
                img.className = 'template-item';
                img.title = 'Click to set as background';
                img.addEventListener('click', () => {
                    setBackground(url);
                });
                templateList.appendChild(img);
            });
        } else {
            templateList.innerHTML = '<p style="color:#888;font-size:12px;">No templates found. Add images to "templates" folder.</p>';
        }
    } catch (error) {
        console.error('Template loading error:', error);
        templateList.innerHTML = '<p style="color:#e74c3c;font-size:12px;">Error loading templates</p>';
    }
}

// ============================================================
// SET BACKGROUND
// ============================================================
function setBackground(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        state.backgroundImage = img;
        drawCanvas();
        document.querySelectorAll('.template-item').forEach(el => {
            el.classList.remove('active');
            if (el.src === url) el.classList.add('active');
        });
    };
    img.onerror = () => {
        alert('Failed to load background image!');
    };
    img.src = url;
}

// ============================================================
// UPLOAD IMAGE
// ============================================================
uploadImage.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    uploadStatus.textContent = 'Uploading...';
    uploadStatus.style.color = '#f39c12';

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();

        if (data.success) {
            uploadStatus.textContent = '✅ Uploaded!';
            uploadStatus.style.color = '#2ecc71';
            addImageToCanvas(data.imageUrl);
            loadUploadedImages();
        } else {
            uploadStatus.textContent = '❌ ' + (data.error || 'Upload failed');
            uploadStatus.style.color = '#e74c3c';
        }
    } catch (error) {
        uploadStatus.textContent = '❌ Upload failed!';
        uploadStatus.style.color = '#e74c3c';
        console.error(error);
    }
    uploadImage.value = '';
});

// ============================================================
// ADD IMAGE TO CANVAS
// ============================================================
function addImageToCanvas(url) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        const id = state.nextId++;
        state.elements.push({
            id: id,
            type: 'image',
            x: Math.random() * (canvas.width - 250) + 50,
            y: Math.random() * (canvas.height - 200) + 50,
            width: 200,
            height: 150,
            imageUrl: url,
            imageElement: img
        });
        state.selectedId = id;
        updateLayersList();
        drawCanvas();
        updateElementControls(id);
    };
    img.onerror = () => {
        alert('Failed to load image!');
    };
    img.src = url;
}

// ============================================================
// ADD TEXT
// ============================================================
addTextBtn.addEventListener('click', () => {
    const text = textInput.value.trim() || 'Hello World!';
    const color = textColor.value;
    const size = parseInt(textSize.value);

    const id = state.nextId++;
    state.elements.push({
        id: id,
        type: 'text',
        x: Math.random() * (canvas.width - 300) + 50,
        y: Math.random() * (canvas.height - 100) + 50,
        content: text,
        color: color,
        size: size,
    });
    state.selectedId = id;
    updateLayersList();
    drawCanvas();
    updateElementControls(id);
});

// Enter ile text əlavə et
textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTextBtn.click();
    }
});

// ============================================================
// TEXT SIZE SLIDER
// ============================================================
textSize.addEventListener('input', () => {
    textSizeValue.textContent = textSize.value + 'px';
});

// ============================================================
// UPDATE LAYERS LIST
// ============================================================
function updateLayersList() {
    if (state.elements.length === 0) {
        layersList.innerHTML = '<p style="color:#888;font-size:12px;">No layers yet</p>';
        return;
    }
    layersList.innerHTML = '';
    // Show from bottom to top
    state.elements.forEach(el => {
        const div = document.createElement('div');
        div.className = 'layer-item' + (el.id === state.selectedId ? ' active' : '');
        let label = '';
        if (el.type === 'text') {
            const displayText = el.content.length > 15 ? el.content.substring(0, 15) + '...' : el.content;
            label = `📝 ${displayText}`;
        } else {
            label = `🖼 Image #${el.id}`;
        }
        div.innerHTML = `
            <span>${label}</span>
            <button onclick="deleteElement(${el.id})" title="Delete">✕</button>
        `;
        div.addEventListener('click', () => {
            state.selectedId = el.id;
            updateLayersList();
            drawCanvas();
            updateElementControls(el.id);
        });
        layersList.appendChild(div);
    });
}

// ============================================================
// DELETE ELEMENT
// ============================================================
function deleteElement(id) {
    state.elements = state.elements.filter(el => el.id !== id);
    if (state.selectedId === id) {
        state.selectedId = null;
        elementControls.innerHTML = '<p style="color:#888;font-size:12px;">Click on an element to edit</p>';
    }
    updateLayersList();
    drawCanvas();
}

// ============================================================
// UPDATE ELEMENT CONTROLS
// ============================================================
function updateElementControls(id) {
    const el = state.elements.find(e => e.id === id);
    if (!el) {
        elementControls.innerHTML = '<p style="color:#888;font-size:12px;">Element not found</p>';
        return;
    }

    if (el.type === 'text') {
        elementControls.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;">
                <label style="font-size:12px;color:#888;">Text:</label>
                <input type="text" id="editText" value="${el.content}" 
                    style="padding:6px;border-radius:6px;border:1px solid #3a3a5a;background:#0d0d1a;color:#fff;width:100%;" />
                
                <label style="font-size:12px;color:#888;">Color:</label>
                <input type="color" id="editColor" value="${el.color}" 
                    style="width:40px;height:35px;border:none;border-radius:6px;cursor:pointer;" />
                
                <label style="font-size:12px;color:#888;">Size: <span id="editSizeValue">${el.size}px</span></label>
                <input type="range" id="editSize" min="10" max="100" value="${el.size}" 
                    style="accent-color:#6c63ff;width:100%;" />
                
                <div style="display:flex;gap:8px;">
                    <label style="font-size:12px;color:#888;">X: <input type="number" id="editX" value="${el.x}" 
                        style="width:60px;padding:4px;border-radius:6px;border:1px solid #3a3a5a;background:#0d0d1a;color:#fff;" /></label>
                    <label style="font-size:12px;color:#888;">Y: <input type="number" id="editY" value="${el.y}" 
                        style="width:60px;padding:4px;border-radius:6px;border:1px solid #3a3a5a;background:#0d0d1a;color:#fff;" /></label>
                </div>
                
                <button class="btn btn-primary" id="updateTextBtn" style="padding:8px;font-size:13px;">✅ Update Text</button>
                <button class="btn btn-danger" id="deleteTextBtn" style="padding:8px;font-size:13px;">🗑 Delete</button>
            </div>
        `;

        // Update text
        document.getElementById('updateTextBtn').addEventListener('click', () => {
            const newText = document.getElementById('editText').value;
            const newColor = document.getElementById('editColor').value;
            const newSize = parseInt(document.getElementById('editSize').value);
            const newX = parseInt(document.getElementById('editX').value) || 0;
            const newY = parseInt(document.getElementById('editY').value) || 0;

            el.content = newText;
            el.color = newColor;
            el.size = newSize;
            el.x = newX;
            el.y = newY;

            drawCanvas();
            updateLayersList();
        });

        // Size slider live update
        document.getElementById('editSize').addEventListener('input', (e) => {
            document.getElementById('editSizeValue').textContent = e.target.value + 'px';
        });

        // Delete button
        document.getElementById('deleteTextBtn').addEventListener('click', () => {
            deleteElement(el.id);
        });

    } else if (el.type === 'image') {
        elementControls.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px;">
                <label style="font-size:12px;color:#888;">Position:</label>
                <div style="display:flex;gap:8px;">
                    <label style="font-size:12px;color:#888;">X: <input type="number" id="editImgX" value="${el.x}" 
                        style="width:60px;padding:4px;border-radius:6px;border:1px solid #3a3a5a;background:#0d0d1a;color:#fff;" /></label>
                    <label style="font-size:12px;color:#888;">Y: <input type="number" id="editImgY" value="${el.y}" 
                        style="width:60px;padding:4px;border-radius:6px;border:1px solid #3a3a5a;background:#0d0d1a;color:#fff;" /></label>
                </div>
                
                <label style="font-size:12px;color:#888;">Size:</label>
                <div style="display:flex;gap:8px;">
                    <label style="font-size:12px;color:#888;">W: <input type="number" id="editImgW" value="${el.width || 200}" 
                        style="width:60px;padding:4px;border-radius:6px;border:1px solid #3a3a5a;background:#0d0d1a;color:#fff;" /></label>
                    <label style="font-size:12px;color:#888;">H: <input type="number" id="editImgH" value="${el.height || 150}" 
                        style="width:60px;padding:4px;border-radius:6px;border:1px solid #3a3a5a;background:#0d0d1a;color:#fff;" /></label>
                </div>
                
                <button class="btn btn-primary" id="updateImageBtn" style="padding:8px;font-size:13px;">✅ Update Image</button>
                <button class="btn btn-danger" id="deleteImageBtn" style="padding:8px;font-size:13px;">🗑 Delete</button>
            </div>
        `;

        document.getElementById('updateImageBtn').addEventListener('click', () => {
            el.x = parseInt(document.getElementById('editImgX').value) || 0;
            el.y = parseInt(document.getElementById('editImgY').value) || 0;
            el.width = parseInt(document.getElementById('editImgW').value) || 20;
            el.height = parseInt(document.getElementById('editImgH').value) || 20;
            drawCanvas();
            updateLayersList();
        });

        document.getElementById('deleteImageBtn').addEventListener('click', () => {
            deleteElement(el.id);
        });
    }
}

// ============================================================
// LOAD UPLOADED IMAGES
// ============================================================
async function loadUploadedImages() {
    try {
        const response = await fetch('/api/uploads');
        const data = await response.json();
        if (data.images && data.images.length > 0) {
            uploadedImages.innerHTML = '';
            data.images.forEach(url => {
                const div = document.createElement('div');
                div.className = 'uploaded-image-item';
                const filename = url.split('/').pop();
                div.innerHTML = `
                    <span style="font-size:11px;">${filename.substring(0, 20)}</span>
                    <div>
                        <button onclick="addImageToCanvas('${url}')" 
                            style="background:#6c63ff;border:none;color:#fff;border-radius:4px;padding:0 8px;cursor:pointer;font-size:11px;margin-right:4px;" 
                            title="Add to canvas">+</button>
                        <button onclick="deleteUploadedImage('${filename}')" 
                            title="Delete">✕</button>
                    </div>
                `;
                uploadedImages.appendChild(div);
            });
        } else {
            uploadedImages.innerHTML = '<p style="color:#888;font-size:12px;">No images uploaded</p>';
        }
    } catch (error) {
        console.error('Error loading uploaded images:', error);
        uploadedImages.innerHTML = '<p style="color:#e74c3c;font-size:12px;">Error loading images</p>';
    }
}

// ============================================================
// DELETE UPLOADED IMAGE
// ============================================================
async function deleteUploadedImage(filename) {
    try {
        const response = await fetch(`/api/delete/${filename}`, {
            method: 'DELETE',
        });
        const data = await response.json();
        if (data.success) {
            loadUploadedImages();
        } else {
            alert('Failed to delete image!');
        }
    } catch (error) {
        console.error('Error deleting image:', error);
        alert('Error deleting image!');
    }
}

// ============================================================
// DOWNLOAD
// ============================================================
downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'design-' + Date.now() + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
});

// ============================================================
// CLEAR ALL
// ============================================================
clearAllBtn.addEventListener('click', () => {
    if (state.elements.length === 0 && !state.backgroundImage) {
        return;
    }
    if (confirm('Are you sure you want to clear everything?')) {
        state.elements = [];
        state.selectedId = null;
        state.backgroundImage = null;
        document.querySelectorAll('.template-item').forEach(el => el.classList.remove('active'));
        updateLayersList();
        drawCanvas();
        elementControls.innerHTML = '<p style="color:#888;font-size:12px;">Click on an element to edit</p>';
    }
});

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
document.addEventListener('keydown', (e) => {
    // Delete key
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
        const id = state.selectedId;
        state.selectedId = null;
        deleteElement(id);
        elementControls.innerHTML = '<p style="color:#888;font-size:12px;">Click on an element to edit</p>';
        e.preventDefault();
    }

    // Ctrl+Z for undo (future feature)
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
    }
});

// ============================================================
// INIT
// ============================================================
loadTemplates();
loadUploadedImages();
drawCanvas();
