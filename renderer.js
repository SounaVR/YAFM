let allFiles = {};
let currentCategory = 'All Files';
const iconMappings = JSON.parse(localStorage.getItem('iconMappings')) || {};
const extensionIcons = {
  '.png': './icons/png.png',
  '.jpg': './icons/jpeg.png',
  '.jpeg': './icons/jpeg.png',
  '.blend': './icons/blend.png',
  '.rar': './icons/tar.gz.png',
  '.zip': './icons/tar.gz.png',
  '.7z': './icons/tar.gz.png',
  '.gz': './icons/tar.gz.png',
  '.txt': './icons/txt.png',
  '.json': './icons/json.png',
  '.exe': './icons/exe.png',
  '.pdf': './icons/pdf.png',
  '.lua': './icons/lua.png',
  '.bat': './icons/bat.png',
  'folder': './icons/folder.png'
};

// Define createFileElement in the global scope
window.createFileElement = function createFileElement(file, listSubfolders, categories) {
  const li = document.createElement('li');

  // Determine the color and text color based on file category
  const fileCategory = categories.find(category =>
    category.extensions.some(ext => file.path.endsWith(ext))
  );
  const color = fileCategory ? fileCategory.color : '#f4f4f4'; // Default background color if no category matches
  const textColor = fileCategory ? fileCategory.textColor : '#000000'; // Default text color if no category matches
  li.style.backgroundColor = color;
  li.style.color = textColor;

  // Get the appropriate icon path
  const fileExtension = file.isDirectory ? 'folder' : `.${file.path.split('.').pop()}`;
  const iconPath = iconMappings[fileExtension] || extensionIcons[fileExtension] || './icons/default-icon.png'; // Default icon if no match

  const iconImg = document.createElement('img');
  iconImg.src = iconPath;
  iconImg.alt = fileExtension;
  iconImg.className = 'file-icon mr-2'; // Add appropriate styling in your CSS

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger btn-sm delete-button mr-2';
  deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>'; // Ensure the icon HTML is correct
  deleteBtn.style.display = 'none';
  deleteBtn.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (confirm(`Are you sure you want to send "${file.name}" to the Recycle Bin ?`)) {
      const success = await window.api.deleteFile(file.path);
      if (success) {
        await refreshFileList();
      }
    }
  });

  if (file.isDirectory && !listSubfolders) {
    const dropdownBtn = document.createElement('button');
    dropdownBtn.innerHTML = '&#x25BC;'; // Unicode for down arrow
    dropdownBtn.className = 'btn btn-secondary btn-sm mr-2';
    let isOpen = false;
    let subFilesList;

    dropdownBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (isOpen) {
        subFilesList.remove();
        isOpen = false;
        dropdownBtn.innerHTML = '&#x25BC;'; // Down arrow
      } else {
        const subFiles = await window.api.getFiles(file.path, getCategories(), false);
        subFilesList = document.createElement('ul');
        subFilesList.className = 'list-group ml-3';
        subFiles.all.forEach(subFile => {
          const subLi = createFileElement(subFile, listSubfolders, categories); // Pass the categories
          subFilesList.appendChild(subLi);
        });
        li.appendChild(subFilesList);
        isOpen = true;
        dropdownBtn.innerHTML = '&#x25B2;'; // Up arrow

        toggleDeleteButtons(document.getElementById('toggle-delete-buttons').checked);
      }
    });
    li.appendChild(dropdownBtn);
  }

  li.appendChild(deleteBtn); // Add the delete button
  li.appendChild(iconImg); // Add the icon before the file name
  li.appendChild(document.createTextNode(file.name));

  li.addEventListener('click', async () => {
    if (!file.isDirectory) {
      await window.api.logFilePath(file.path);
      window.api.openFile(file.path);
    }
  });

  li.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
    window.api.openLocation(file.path);
  });

  return li;
}

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await loadSettings();
  const watchFolders = settings?.watchFolders || [];
  const listSubfolders = settings?.listSubfolders || false;
  const showDeleteButtons = settings?.showDeleteButtons || false;

  document.getElementById('selected-folder-path').textContent = watchFolders.join(', ') || '';
  document.getElementById('list-subfolders').checked = listSubfolders;
  document.getElementById('toggle-delete-buttons').checked = showDeleteButtons;

  if (watchFolders.length > 0) {
    window.api.watchFolder(watchFolders);
    const files = await window.api.getFiles(watchFolders, getCategories(), listSubfolders);
    displayFiles(files, getCategories(), listSubfolders);
    updateElementCount(files.all.length);
  }

  toggleDeleteButtons(showDeleteButtons);

  document.getElementById('add-folder-btn').addEventListener('click', async () => {
    const folderPaths = await window.api.selectFolder();
    if (folderPaths.length > 0) {
      const currentFolders = document.getElementById('selected-folder-path').textContent.split(', ').filter(Boolean);
      const updatedFolders = [...new Set([...currentFolders, ...folderPaths])];
      updateWatchedFoldersList(updatedFolders);
      saveSettings({
        watchFolders: updatedFolders,
        categories: getCategories(),
        listSubfolders: document.getElementById('list-subfolders').checked,
        showDeleteButtons: document.getElementById('toggle-delete-buttons').checked
      });
      window.api.watchFolder(updatedFolders);
      await refreshFileList();
    }
  });

  document.getElementById('select-folder-btn').addEventListener('click', async () => {
    const folderPaths = await window.api.selectFolder();
    if (folderPaths.length > 0) {
      updateWatchedFoldersList(folderPaths);
      saveSettings({
        watchFolders: folderPaths,
        categories: getCategories(),
        listSubfolders: document.getElementById('list-subfolders').checked,
        showDeleteButtons: document.getElementById('toggle-delete-buttons').checked
      });
      window.api.watchFolder(folderPaths);
      await refreshFileList();
    }
  });

  document.getElementById('toggle-watched-folders-btn').addEventListener('click', () => {
    const container = document.getElementById('watched-folders-container');
    if (container.style.display === 'none') {
      container.style.display = 'block';
      document.getElementById('toggle-watched-folders-btn').textContent = 'Hide Watched Folders';
    } else {
      container.style.display = 'none';
      document.getElementById('toggle-watched-folders-btn').textContent = 'Show Watched Folders';
    }
  });

  document.getElementById('add-icon-btn').addEventListener('click', () => {
    const iconModal = document.getElementById('icon-modal');
    iconModal.classList.add('show');
    iconModal.style.display = 'block';
  });

  document.getElementById('toggle-category-buttons').addEventListener('change', () => {
    const showCategoryButtons = document.getElementById('toggle-category-buttons').checked;
    toggleCategoryButtons(showCategoryButtons);
  });

  window.api.onRefreshFiles(async () => {
    await refreshFileList();
  });

  document.getElementById('search-bar').addEventListener('input', (event) => {
    const searchTerm = event.target.value.toLowerCase();
    const currentCategory = document.getElementById('current-category-title').textContent;
    const categories = getCategories();
    const listSubfolders = document.getElementById('list-subfolders').checked;

    let files = allFiles[currentCategory];
    if (currentCategory === 'Recent Files') {
      files = allFiles.recent;
    } else if (!files) {
      files = allFiles.all;
    }

    const filteredFiles = files.filter(file => file.name.toLowerCase().includes(searchTerm));
    const currentCategoryData = categories.find(category => category.name === currentCategory);
    const color = currentCategoryData ? currentCategoryData.color : '#f4f4f4';
    const textColor = currentCategoryData ? currentCategoryData.textColor : '#000000';
    displayCategoryFiles(currentCategory, filteredFiles, color, textColor, listSubfolders, categories);
  });

  // Icon modal and form handling
  const iconModal = document.getElementById('icon-modal');
  const iconForm = document.getElementById('icon-form');
  const closeIconModalBtn = iconModal.querySelector('.close');

  closeIconModalBtn.addEventListener('click', () => {
    iconModal.classList.remove('show');
    iconModal.style.display = 'none';
  });

  window.addEventListener('click', (event) => {
    if (event.target === iconModal) {
      iconModal.classList.remove('show');
      iconModal.style.display = 'none';
    }
  });

  iconForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const extension = document.getElementById('extension').value.trim();
    const iconFile = document.getElementById('icon-file').files[0];

    if (extension && iconFile) {
      const reader = new FileReader();
      reader.onload = async () => {
        iconMappings[extension] = reader.result;
        localStorage.setItem('iconMappings', JSON.stringify(iconMappings));
        alert('Icon added successfully!');
        iconModal.classList.remove('show');
        iconModal.style.display = 'none';
        iconForm.reset();
        await refreshFileList();
      };
      reader.readAsDataURL(iconFile);
    }
  });

  // Open Recycle Bin button handler
  document.getElementById('open-recycle-bin-btn').addEventListener('click', async () => {
    const success = await window.api.openRecycleBin();
    if (!success) {
      alert('Failed to open Recycle Bin.');
    }
  });
});

function updateWatchedFoldersList(watchFolders) {
  const watchedFoldersList = document.getElementById('watched-folders-list');
  watchedFoldersList.innerHTML = '';

  watchFolders.forEach((folderPath, index) => {
    const listItem = document.createElement('li');
    listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
    listItem.textContent = folderPath;

    const removeButton = document.createElement('button');
    removeButton.className = 'btn btn-danger btn-sm';
    removeButton.textContent = 'Remove';
    removeButton.addEventListener('click', async () => {
      watchFolders.splice(index, 1);
      updateWatchedFoldersList(watchFolders);
      saveSettings({
        watchFolders,
        categories: getCategories(),
        listSubfolders: document.getElementById('list-subfolders').checked,
        showDeleteButtons: document.getElementById('toggle-delete-buttons').checked
      });

      await refreshFileList(); // Refresh file list after updating watched folders
    });

    listItem.appendChild(removeButton);
    watchedFoldersList.appendChild(listItem);
  });

  document.getElementById('selected-folder-path').textContent = watchFolders.join(', ');
}

async function refreshFileList() {
  const watchFolders = document.getElementById('selected-folder-path').textContent.split(', ').filter(Boolean);
  const categories = getCategories();
  const listSubfolders = document.getElementById('list-subfolders').checked;
  const currentCategory = document.getElementById('current-category-title').textContent;

  showLoading();

  try {
    const { fileList, countExceeded, fileCount } = await window.api.walkSync(watchFolders, listSubfolders, false);

    // Save all files for later use
    allFiles = { all: fileList };

    displayFiles(allFiles, categories, listSubfolders);

    if (currentCategory) {
      const currentFiles = fileList.filter(file => categories.find(category => category.name === currentCategory)?.extensions.some(ext => file.path.endsWith(ext)));
      const currentCategoryData = categories.find(category => category.name === currentCategory);
      const color = currentCategoryData ? currentCategoryData.color : '#f4f4f4';
      const textColor = currentCategoryData ? currentCategoryData.textColor : '#000000';
      displayCategoryFiles(currentCategory, currentFiles, color, textColor, listSubfolders, categories);
    }

    updateElementCount(fileList.length);
  } catch (error) {
    console.error("Error refreshing file list:", error);
  } finally {
    hideLoading();
  }
}

document.getElementById('list-subfolders').addEventListener('change', async () => {
  await handleListSubfoldersChange();
});

document.getElementById('toggle-delete-buttons').addEventListener('change', () => {
  handleToggleDeleteButtons();
});

document.getElementById('add-category-btn').addEventListener('click', () => {
  showCategoryModal();
});

document.getElementById('save-category-btn').addEventListener('click', () => {
  saveCategory();
});

document.getElementById('cancel-category-btn').addEventListener('click', () => {
  hideCategoryModal();
});

function showLoading() {
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'loading-overlay';
  loadingOverlay.style.position = 'fixed';
  loadingOverlay.style.top = '0';
  loadingOverlay.style.left = '0';
  loadingOverlay.style.width = '100%';
  loadingOverlay.style.height = '100%';
  loadingOverlay.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
  loadingOverlay.style.zIndex = '1000';
  loadingOverlay.style.display = 'flex';
  loadingOverlay.style.alignItems = 'center';
  loadingOverlay.style.justifyContent = 'center';
  loadingOverlay.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="sr-only">Loading...</span></div>';
  document.body.appendChild(loadingOverlay);
}

function hideLoading() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    document.body.removeChild(loadingOverlay);
  }
}

async function handleListSubfoldersChange() {
  console.log("Handling list subfolders change...");
  const listSubfoldersCheckbox = document.getElementById('list-subfolders');
  const listSubfolders = listSubfoldersCheckbox.checked;
  const showDeleteButtons = document.getElementById('toggle-delete-buttons').checked;

  showLoading();

  try {
    await refreshFileList();
    saveSettings({
      watchFolders: document.getElementById('selected-folder-path').textContent.split(', ').filter(Boolean),
      categories: getCategories(),
      listSubfolders,
      showDeleteButtons
    });
  } catch (error) {
    console.error("Error listing subfolders:", error);
  } finally {
    hideLoading();
  }
}

function handleToggleDeleteButtons() {
  const showDeleteButtons = document.getElementById('toggle-delete-buttons').checked;
  toggleDeleteButtons(showDeleteButtons);
  const watchFolder = document.getElementById('selected-folder-path').textContent;
  const categories = getCategories();
  const listSubfolders = document.getElementById('list-subfolders').checked;
  saveSettings({ watchFolder, categories, listSubfolders, showDeleteButtons });
}

function updateElementCount(count) {
  document.getElementById('element-count').textContent = `Files: ${count}`;
}

function displayFiles(files, categories, listSubfolders) {
  const categoriesContainer = document.getElementById('categories');
  categoriesContainer.innerHTML = ''; // Clear existing categories

  // Save all files for later use
  allFiles = files;

  if (!files.all) {
    files.all = [];
  }

  // Sort files by modification date (newest to oldest)
  files.all.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));

  const allFilesDiv = createCategoryDiv('All Files', '#f4f4f4', '#000000');
  allFilesDiv.addEventListener('click', () => displayCategoryFiles('All Files', files.all, '#f4f4f4', '#000000', listSubfolders, categories));
  categoriesContainer.appendChild(allFilesDiv);

  const recentFilesDiv = createCategoryDiv('Recently Opened Files', '#f4f4f4', '#000000', true);
  recentFilesDiv.addEventListener('click', () => displayRecentFiles());
  categoriesContainer.appendChild(recentFilesDiv);

  document.getElementById('clear-recent-files-btn').addEventListener('click', async (event) => {
    event.stopPropagation();
    await window.api.clearRecentFiles();
    displayRecentFiles();
  });

  categories.forEach((category, index) => {
    const categoryFiles = files[category.name]?.sort((a, b) => new Date(b.mtime) - new Date(a.mtime)) || [];
    const categoryDiv = createCategoryDiv(category.name, category.color, category.textColor, false, true);
    categoryDiv.addEventListener('click', () => displayCategoryFiles(category.name, categoryFiles, category.color, category.textColor, listSubfolders, categories));
    categoriesContainer.appendChild(categoryDiv);
    addCategoryButtonsEventListeners(categoryDiv, index, category.name);
  });

  toggleCategoryButtons(document.getElementById('toggle-category-buttons').checked);
  toggleDeleteButtons(document.getElementById('toggle-delete-buttons').checked);

  // Display the first category by default
  if (categories.length > 0) {
    displayCategoryFiles(categories[0].name, files[categories[0].name] || [], categories[0].color, categories[0].textColor, listSubfolders, categories);
  }
}


function displayCategoryFiles(categoryName, files, color, textColor, listSubfolders, categories) {
  currentCategory = categoryName;

  const categoryTitle = document.getElementById('current-category-title');
  categoryTitle.textContent = categoryName;

  // Set CSS variables for dynamic styling
  document.documentElement.style.setProperty('--dynamic-bg-color', color);
  document.documentElement.style.setProperty('--dynamic-text-color', textColor);

  const fileList = document.getElementById('current-files');
  fileList.innerHTML = '';

  files.forEach(file => {
    const li = createFileElement(file, listSubfolders, categories);
    fileList.appendChild(li);
  });

  toggleDeleteButtons(document.getElementById('toggle-delete-buttons').checked);

  // Highlight the selected category
  const categoryItems = document.querySelectorAll('.category-item');
  categoryItems.forEach(item => {
    if (item.textContent === categoryName) {
      item.parentNode.classList.add('selected-category');
    } else {
      item.parentNode.classList.remove('selected-category');
    }
  });
}

async function displayRecentFiles() {
  const recentFiles = await window.api.readRecentFiles();
  const categories = getCategories(); // Get the categories
  const categoryTitle = document.getElementById('current-category-title');
  categoryTitle.textContent = 'Recent Files';

  // Set CSS variables for dynamic styling for recent files
  document.documentElement.style.setProperty('--dynamic-bg-color', '#f4f4f4');
  document.documentElement.style.setProperty('--dynamic-text-color', '#000000');

  const fileList = document.getElementById('current-files');
  fileList.innerHTML = '';

  recentFiles.forEach(file => {
    const fileCategory = categories.find(category =>
      category.extensions.some(ext => file.path.endsWith(ext))
    );
    const color = fileCategory ? fileCategory.color : '#f4f4f4'; // Default color if no category matches
    const textColor = fileCategory ? fileCategory.textColor : '#000000';

    const li = createFileElement(file, false, categories);
    fileList.appendChild(li);
  });

  toggleDeleteButtons(document.getElementById('toggle-delete-buttons').checked);
}

function createCategoryDiv(name, color, textColor, isRecent = false, isCustom = false) {
  const categoryDiv = document.createElement('div');
  categoryDiv.className = 'list-group-item list-group-item-action';
  categoryDiv.style.backgroundColor = color;
  categoryDiv.style.color = textColor;

  categoryDiv.innerHTML = `
    <div class="category-item">${name}</div>
    ${isRecent ? '<button id="clear-recent-files-btn" class="btn btn-danger btn-sm ml-2 category-buttons">Clear</button>' : ''}
    ${isCustom ? `
    <div class="category-buttons mt-2">
      <button class="btn btn-secondary btn-sm move-up-category-btn">&#x25B2;</button>
      <button class="btn btn-secondary btn-sm move-down-category-btn">&#x25BC;</button>
      <button class="btn btn-warning btn-sm edit-category-btn">&#x270F;&#xFE0F;</button>
      <button class="btn btn-danger btn-sm delete-category-btn">&#x1F5D1;&#xFE0F;</button>
    </div>` : ''}
  `;
  return categoryDiv;
}

function addCategoryButtonsEventListeners(categoryDiv, index, categoryName) {
  categoryDiv.querySelector('.move-up-category-btn').addEventListener('click', (event) => {
    event.stopPropagation();
    moveCategoryUp(index);
  });
  categoryDiv.querySelector('.move-down-category-btn').addEventListener('click', (event) => {
    event.stopPropagation();
    moveCategoryDown(index);
  });
  categoryDiv.querySelector('.edit-category-btn').addEventListener('click', (event) => {
    event.stopPropagation();
    editCategory(categoryName);
  });
  categoryDiv.querySelector('.delete-category-btn').addEventListener('click', (event) => {
    event.stopPropagation();
    deleteCategory(categoryName);
  });
}

function getCategories() {
  return JSON.parse(localStorage.getItem('categories')) || [
    { name: 'Images Files', extensions: ['.png', '.jpg', '.jpeg'], color: '#d1e7dd', textColor: '#000000' },
    { name: 'Blender Files', extensions: ['.blend'], color: '#ffebcc', textColor: '#000000' },
    { name: 'ZIP Archives', extensions: ['.rar', '.zip', '.tar.gz', '.7z'], color: '#f5c6cb', textColor: '#000000' },
    { name: 'Text Files', extensions: ['.txt'], color: '#f4f4f4', textColor: '#000000' },
    { name: 'Executable Files', extensions: ['.exe'], color: '#cfe2ff', textColor: '#000000' },
  ];
}

function saveCategories(categories) {
  localStorage.setItem('categories', JSON.stringify(categories));
}

async function saveSettings(settings) {
  await window.api.saveSettings(settings);
}

async function loadSettings() {
  const settings = await window.api.loadSettings();
  return settings ? { ...settings, watchFolders: settings.watchFolders || [] } : {};
}

function showCategoryModal(category = {}) {
  document.getElementById('category-name').value = category.name || '';
  document.getElementById('category-extensions').value = category.extensions ? category.extensions.join(', ') : '';
  document.getElementById('category-color').value = category.color || '#f4f4f4';
  document.getElementById('category-text-color').value = category.textColor || '#000000';
  document.getElementById('category-modal').dataset.editing = category.name || '';
  document.getElementById('category-modal').classList.add('show');
  document.getElementById('category-modal').style.display = 'block';
}

function hideCategoryModal() {
  document.getElementById('category-modal').classList.remove('show');
  document.getElementById('category-modal').style.display = 'none';
}

function saveCategory() {
  const name = document.getElementById('category-name').value.trim();
  const extensions = document.getElementById('category-extensions').value.split(',').map(ext => ext.trim());
  const color = document.getElementById('category-color').value;
  const textColor = document.getElementById('category-text-color').value;

  if (!name || extensions.length === 0) {
    alert('Please provide both a name and at least one extension.');
    return;
  }

  const categories = getCategories();
  const existingCategoryName = document.getElementById('category-modal').dataset.editing;
  if (existingCategoryName) {
    const existingCategoryIndex = categories.findIndex(category => category.name === existingCategoryName);
    categories[existingCategoryIndex] = { name, extensions, color, textColor };
  } else {
    categories.push({ name, extensions, color, textColor });
  }

  saveCategories(categories);
  hideCategoryModal();
  refreshCategoryList();
}

function editCategory(name) {
  const categories = getCategories();
  const category = categories.find(category => category.name === name);

  if (category) {
    showCategoryModal(category);
  }
}

function deleteCategory(name) {
  if (confirm(`Are you sure you want to delete the category: ${name}?`)) {
    const categories = getCategories();
    const updatedCategories = categories.filter(category => category.name !== name);

    saveCategories(updatedCategories);
    refreshCategoryList();
  }
}

function refreshCategoryList() {
  const watchFolders = document.getElementById('selected-folder-path').textContent.split(', ').filter(Boolean);
  const listSubfolders = document.getElementById('list-subfolders').checked;
  const categories = getCategories();

  if (watchFolders.length > 0) {
    window.api.getFiles(watchFolders, categories, listSubfolders).then(files => {
      displayFiles(files, categories, listSubfolders);
      updateElementCount(files.all.length);
    }).catch(error => {
      console.error('Error fetching files:', error);
      displayFiles({ all: [] }, categories, listSubfolders);
      updateElementCount(0);
    });
  } else {
    // No watched folders, just refresh the categories display
    displayFiles({ all: [] }, categories, listSubfolders);
    updateElementCount(0);
  }
}

function moveCategoryUp(index) {
  const categories = getCategories();
  if (index > 0) {
    [categories[index], categories[index - 1]] = [categories[index - 1], categories[index]];
    saveCategories(categories);
    const watchFolders = document.getElementById('selected-folder-path').textContent.split(', ').filter(Boolean);
    const listSubfolders = document.getElementById('list-subfolders').checked;
    window.api.getFiles(watchFolders, categories, listSubfolders).then(files => {
      displayFiles(files, categories, listSubfolders);
      updateElementCount(files.all.length);
    });
  }
}

function moveCategoryDown(index) {
  const categories = getCategories();
  if (index < categories.length - 1) {
    [categories[index], categories[index + 1]] = [categories[index + 1], categories[index]];
    saveCategories(categories);
    const watchFolders = document.getElementById('selected-folder-path').textContent.split(', ').filter(Boolean);
    const listSubfolders = document.getElementById('list-subfolders').checked;
    window.api.getFiles(watchFolders, categories, listSubfolders).then(files => {
      displayFiles(files, categories, listSubfolders);
      updateElementCount(files.all.length);
    });
  }
}

function toggleCategoryButtons(show) {
  const categoryButtons = document.querySelectorAll('.category-buttons, #clear-recent-files-btn');
  categoryButtons.forEach(btn => {
    btn.style.display = show ? 'flex' : 'none';
  });
}

function toggleDeleteButtons(show) {
  const deleteButtons = document.querySelectorAll('.delete-button');
  deleteButtons.forEach(btn => {
    btn.style.display = show ? 'inline-block' : 'none';
  });
}

document.getElementById('search-bar').addEventListener('input', (event) => {
  const searchTerm = event.target.value.toLowerCase();
  const currentCategory = document.getElementById('current-category-title').textContent;
  const categories = getCategories();
  const listSubfolders = document.getElementById('list-subfolders').checked;

  let files = allFiles[currentCategory];
  if (currentCategory === 'Recent Files') {
    files = allFiles.recent;
  } else if (!files) {
    files = allFiles.all;
  }

  const filteredFiles = files.filter(file => file.name.toLowerCase().includes(searchTerm));
  const currentCategoryData = categories.find(category => category.name === currentCategory);
  const color = currentCategoryData ? currentCategoryData.color : '#f4f4f4';
  const textColor = currentCategoryData ? currentCategoryData.textColor : '#000000';
  displayCategoryFiles(currentCategory, filteredFiles, color, textColor, listSubfolders, categories);
});
