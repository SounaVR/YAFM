document.addEventListener('DOMContentLoaded', async () => {
  const settings = await loadSettings();
  const watchFolder = settings?.watchFolder;
  const listSubfolders = settings?.listSubfolders || false;
  const showDeleteButtons = settings?.showDeleteButtons || false;

  document.getElementById('selected-folder-path').textContent = watchFolder || '';
  document.getElementById('list-subfolders').checked = listSubfolders;
  document.getElementById('toggle-delete-buttons').checked = showDeleteButtons;

  if (watchFolder) {
    const files = await window.api.getFiles(watchFolder, getCategories(), listSubfolders);
    displayFiles(files, getCategories(), listSubfolders);
    updateElementCount(files.all.length);
  }

  toggleDeleteButtons(showDeleteButtons);

  document.getElementById('toggle-category-buttons').addEventListener('change', () => {
    const showCategoryButtons = document.getElementById('toggle-category-buttons').checked;
    toggleCategoryButtons(showCategoryButtons);
  });
});

document.getElementById('select-folder-btn').addEventListener('click', async () => {
  const folderPath = await window.api.selectFolder();
  if (folderPath) {
    document.getElementById('selected-folder-path').textContent = folderPath;
    const categories = getCategories();
    const listSubfolders = document.getElementById('list-subfolders').checked;
    const files = await window.api.getFiles(folderPath, categories, listSubfolders);
    displayFiles(files, categories, listSubfolders);
    saveSettings({ watchFolder: folderPath, categories, listSubfolders, showDeleteButtons: true });
    updateElementCount(files.all.length);
  }
});

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

async function handleListSubfoldersChange() {
  const listSubfoldersCheckbox = document.getElementById('list-subfolders');
  const watchFolder = document.getElementById('selected-folder-path').textContent;
  const categories = getCategories();
  const listSubfolders = listSubfoldersCheckbox.checked;
  const showDeleteButtons = document.getElementById('toggle-delete-buttons').checked;

  if (listSubfolders) {
    const files = await window.api.getFiles(watchFolder, categories, true);
    if (files.all.length > 10000) {
      const confirm = await window.api.confirmLargeListing(files.all.length);
      if (!confirm) {
        listSubfoldersCheckbox.checked = false;
        return;
      }
    }
  }

  saveSettings({ watchFolder, categories, listSubfolders, showDeleteButtons });
  const files = await window.api.getFiles(watchFolder, categories, listSubfolders);
  displayFiles(files, categories, listSubfolders);
  updateElementCount(files.all.length);
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
  document.getElementById('element-count').textContent = `Number of elements: ${count}`;
}

async function displayFiles(files, categories, listSubfolders) {
  const categoriesContainer = document.getElementById('categories');
  categoriesContainer.innerHTML = ''; // Clear existing categories

  const allFilesDiv = createCategoryDiv('All Files', '#f4f4f4');
  allFilesDiv.addEventListener('click', () => displayCategoryFiles('All Files', files.all, '#f4f4f4', listSubfolders));
  categoriesContainer.appendChild(allFilesDiv);

  const recentFilesDiv = createCategoryDiv('Recent Files', '#f4f4f4', true);
  recentFilesDiv.addEventListener('click', displayRecentFiles);
  categoriesContainer.appendChild(recentFilesDiv);

  document.getElementById('clear-recent-files-btn').addEventListener('click', async (event) => {
    event.stopPropagation();
    await window.api.clearRecentFiles();
    displayRecentFiles();
  });

  categories.forEach((category, index) => {
    const categoryDiv = createCategoryDiv(category.name, category.color, false, true);
    categoryDiv.addEventListener('click', () => displayCategoryFiles(category.name, files[category.name], category.color, listSubfolders));
    categoriesContainer.appendChild(categoryDiv);
    addCategoryButtonsEventListeners(categoryDiv, index, category.name);
  });

  toggleCategoryButtons(document.getElementById('toggle-category-buttons').checked);
  toggleDeleteButtons(document.getElementById('toggle-delete-buttons').checked);

  displayCategoryFiles('All Files', files.all, '#f4f4f4', listSubfolders);
}

async function displayRecentFiles() {
  const recentFiles = await window.api.readRecentFiles();
  const categoryTitle = document.getElementById('current-category-title');
  categoryTitle.textContent = 'Recent Files';
  categoryTitle.style.backgroundColor = '#f4f4f4';

  const fileList = document.getElementById('current-files');
  fileList.innerHTML = '';

  recentFiles.forEach(filePath => {
    const li = document.createElement('li');
    li.textContent = filePath;
    fileList.appendChild(li);
  });
}

function displayCategoryFiles(categoryName, files, color, listSubfolders) {
  const categoryTitle = document.getElementById('current-category-title');
  categoryTitle.textContent = categoryName;
  categoryTitle.style.backgroundColor = color;

  const fileList = document.getElementById('current-files');
  fileList.innerHTML = '';

  files.forEach(file => {
    const li = createFileElement(file, listSubfolders);
    fileList.appendChild(li);
  });

  toggleDeleteButtons(document.getElementById('toggle-delete-buttons').checked);
}

function createFileElement(file, listSubfolders) {
  const li = document.createElement('li');
  li.className = 'align-items-center';

  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '🗑️';
  deleteBtn.className = 'btn btn-danger btn-sm delete-button';
  deleteBtn.style.display = 'none';
  deleteBtn.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete the file: ${file.name}?`)) {
      const success = await window.api.deleteFile(file.path);
      if (success) {
        refreshFileList();
      }
    }
  });
  li.appendChild(deleteBtn);

  if (file.isDirectory && !listSubfolders) {
    const dropdownBtn = document.createElement('button');
    dropdownBtn.innerHTML = '&#x25BC;'; // Unicode for down arrow
    dropdownBtn.className = 'btn btn-secondary btn-sm';
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
          const subLi = createFileElement(subFile, listSubfolders);
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

function createCategoryDiv(name, color, isRecent = false, isCustom = false) {
  const categoryDiv = document.createElement('div');
  categoryDiv.className = 'list-group-item list-group-item-action';
  categoryDiv.style.backgroundColor = color;

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

async function refreshFileList() {
  const watchFolder = document.getElementById('selected-folder-path').textContent;
  const listSubfolders = document.getElementById('list-subfolders').checked;
  const categories = getCategories();
  if (watchFolder) {
    const files = await window.api.getFiles(watchFolder, categories, listSubfolders);
    displayFiles(files, categories, listSubfolders);
    updateElementCount(files.all.length);
  }
}

function getCategories() {
  return JSON.parse(localStorage.getItem('categories')) || [
    { name: 'Images Files', extensions: ['.png', '.jpg', '.jpeg'], color: '#f4f4f4' },
    { name: 'Blender Files', extensions: ['.blend'], color: '#f4f4f4' },
    { name: 'ZIP Archives', extensions: ['.rar', '.zip', '.tar.gz'], color: '#f4f4f4' },
    { name: 'Text Files', extensions: ['.txt'], color: '#f4f4f4' },
    { name: 'Executable Files', extensions: ['.exe'], color: '#f4f4f4' },
  ];
}

function saveCategories(categories) {
  localStorage.setItem('categories', JSON.stringify(categories));
}

async function saveSettings(settings) {
  await window.api.saveSettings(settings);
}

async function loadSettings() {
  return await window.api.loadSettings();
}

function showCategoryModal(category = {}) {
  document.getElementById('category-name').value = category.name || '';
  document.getElementById('category-extensions').value = category.extensions ? category.extensions.join(', ') : '';
  document.getElementById('category-color').value = category.color || '#f4f4f4';
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

  if (!name || extensions.length === 0) {
    alert('Please provide both a name and at least one extension.');
    return;
  }

  const categories = getCategories();
  const existingCategoryName = document.getElementById('category-modal').dataset.editing;
  if (existingCategoryName) {
    const existingCategoryIndex = categories.findIndex(category => category.name === existingCategoryName);
    categories[existingCategoryIndex] = { name, extensions, color };
  } else {
    categories.push({ name, extensions, color });
  }

  saveCategories(categories);
  hideCategoryModal();
  refreshFileList();
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
    refreshFileList();
  }
}

function moveCategoryUp(index) {
  const categories = getCategories();
  if (index > 0) {
    [categories[index], categories[index - 1]] = [categories[index - 1], categories[index]];
    saveCategories(categories);
    refreshFileList();
  }
}

function moveCategoryDown(index) {
  const categories = getCategories();
  if (index < categories.length - 1) {
    [categories[index], categories[index + 1]] = [categories[index + 1], categories[index]];
    saveCategories(categories);
    refreshFileList();
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
