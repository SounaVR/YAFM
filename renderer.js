let allFiles = {};
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

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await loadSettings();
  const watchFolder = settings?.watchFolder;
  const listSubfolders = settings?.listSubfolders || false;
  const showDeleteButtons = settings?.showDeleteButtons || false;

  document.getElementById('selected-folder-path').textContent = watchFolder || '';
  document.getElementById('list-subfolders').checked = listSubfolders;
  document.getElementById('toggle-delete-buttons').checked = showDeleteButtons;

  if (watchFolder) {
    window.api.watchFolder(watchFolder);
    const files = await window.api.getFiles(watchFolder, getCategories(), listSubfolders);
    displayFiles(files, getCategories(), listSubfolders);
    updateElementCount(files.all.length);
  }

  toggleDeleteButtons(showDeleteButtons);

  document.getElementById('toggle-category-buttons').addEventListener('change', () => {
    const showCategoryButtons = document.getElementById('toggle-category-buttons').checked;
    toggleCategoryButtons(showCategoryButtons);
  });

  window.api.onRefreshFiles(async () => {
    const folderPath = document.getElementById('selected-folder-path').textContent;
    const categories = getCategories();
    const listSubfolders = document.getElementById('list-subfolders').checked;
    const currentCategory = document.getElementById('current-category-title').textContent;

    const files = await window.api.getFiles(folderPath, categories, listSubfolders);
    displayFiles(files, categories, listSubfolders);

    if (currentCategory) {
      const currentFiles = files[currentCategory] || files.all;
      const currentCategoryData = categories.find(category => category.name === currentCategory);
      const color = currentCategoryData ? currentCategoryData.color : '#f4f4f4';
      const textColor = currentCategoryData ? currentCategoryData.textColor : '#000000';
      displayCategoryFiles(currentCategory, currentFiles, color, textColor, listSubfolders, categories);
    }

    updateElementCount(files.all.length);
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
  const iconMappings = JSON.parse(localStorage.getItem('iconMappings')) || {};

  const iconModal = document.getElementById('icon-modal');
  const addIconBtn = document.getElementById('add-icon-btn');
  const iconForm = document.getElementById('icon-form');
  const closeIconModalBtn = iconModal.querySelector('.close');

  addIconBtn.addEventListener('click', () => {
    iconModal.classList.add('show');
    iconModal.style.display = 'block';
  });

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

  iconForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const extension = document.getElementById('extension').value.trim();
    const iconFile = document.getElementById('icon-file').files[0];

    if (extension && iconFile) {
      const reader = new FileReader();
      reader.onload = () => {
        iconMappings[extension] = reader.result;
        localStorage.setItem('iconMappings', JSON.stringify(iconMappings));
        alert('Icon added successfully!');
        iconModal.classList.remove('show');
        iconModal.style.display = 'none';
        iconForm.reset();
      };
      reader.readAsDataURL(iconFile);
    }
  });

  async function refreshFileList(currentCategory) {
    const watchFolder = document.getElementById('selected-folder-path').textContent;
    const listSubfolders = document.getElementById('list-subfolders').checked;
    const categories = getCategories();
    if (watchFolder) {
      const files = await window.api.getFiles(watchFolder, categories, listSubfolders);
      displayFiles(files, categories, listSubfolders);

      if (currentCategory) {
        const currentFiles = files[currentCategory] || files.all;
        const currentCategoryData = categories.find(category => category.name === currentCategory);
        const color = currentCategoryData ? currentCategoryData.color : '#f4f4f4';
        const textColor = currentCategoryData ? currentCategoryData.textColor : '#000000';
        displayCategoryFiles(currentCategory, currentFiles, color, textColor, listSubfolders, categories);
      }

      updateElementCount(files.all.length);
    }
  }

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
      if (confirm(`Are you sure you want to delete the file: ${file.name}?`)) {
        const success = await window.api.deleteFile(file.path);
        if (success) {
          const currentCategory = document.getElementById('current-category-title').textContent;
          refreshFileList(currentCategory);
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
  };
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
    window.api.watchFolder(folderPath); // Watch the new folder
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
  const currentCategory = document.getElementById('current-category-title').textContent;

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

  if (currentCategory) {
    const currentFiles = files[currentCategory] || files.all;
    const currentCategoryData = categories.find(category => category.name === currentCategory);
    const color = currentCategoryData ? currentCategoryData.color : '#f4f4f4';
    const textColor = currentCategoryData ? currentCategoryData.textColor : '#000000';
    displayCategoryFiles(currentCategory, currentFiles, color, textColor, listSubfolders, categories);
  }

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
  document.getElementById('element-count').textContent = `Files: ${count}`;
}

async function displayFiles(files, categories, listSubfolders) {
  const categoriesContainer = document.getElementById('categories');
  categoriesContainer.innerHTML = ''; // Clear existing categories

  // Save all files for later use in search, including recent files
  allFiles = files;

  // Sort files by modification date (newest to oldest)
  files.all.sort((a, b) => new Date(b.mtime) - new Date(a.mtime));

  const allFilesDiv = createCategoryDiv('All Files', '#f4f4f4', '#000000');
  allFilesDiv.addEventListener('click', () => displayCategoryFiles('All Files', files.all, '#f4f4f4', '#000000', listSubfolders, categories));
  categoriesContainer.appendChild(allFilesDiv);

  const recentFilesDiv = createCategoryDiv('Recent Files', '#f4f4f4', '#000000', true);
  recentFilesDiv.addEventListener('click', () => displayCategoryFiles('Recent Files', files.recent, '#f4f4f4', '#000000', listSubfolders, categories));
  categoriesContainer.appendChild(recentFilesDiv);

  document.getElementById('clear-recent-files-btn').addEventListener('click', async (event) => {
    event.stopPropagation();
    await window.api.clearRecentFiles();
    displayRecentFiles();
  });

  categories.forEach((category, index) => {
    const categoryFiles = files[category.name].sort((a, b) => new Date(b.mtime) - new Date(a.mtime)); // Sort category files
    const categoryDiv = createCategoryDiv(category.name, category.color, category.textColor, false, true);
    categoryDiv.addEventListener('click', () => displayCategoryFiles(category.name, categoryFiles, category.color, category.textColor, listSubfolders, categories));
    categoriesContainer.appendChild(categoryDiv);
    addCategoryButtonsEventListeners(categoryDiv, index, category.name);
  });

  toggleCategoryButtons(document.getElementById('toggle-category-buttons').checked);
  toggleDeleteButtons(document.getElementById('toggle-delete-buttons').checked);

  // Display the first category by default
  if (categories.length > 0) {
    displayCategoryFiles(categories[0].name, files[categories[0].name], categories[0].color, categories[0].textColor, listSubfolders, categories);
  }
}

function displayCategoryFiles(categoryName, files, color, textColor, listSubfolders, categories) {
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

  recentFiles.forEach(filePath => {
    const fileCategory = categories.find(category =>
      category.extensions.some(ext => filePath.endsWith(ext))
    );
    const color = fileCategory ? fileCategory.color : '#f4f4f4'; // Default color if no category matches

    const li = document.createElement('li');
    li.className = 'align-items-center';
    li.style.backgroundColor = color; // Apply the category color

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️';
    deleteBtn.className = 'btn btn-danger btn-sm delete-button';
    deleteBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      if (confirm(`Are you sure you want to delete the file: ${filePath}?`)) {
        const success = await window.api.deleteFile(filePath);
        if (success) {
          displayRecentFiles();
        }
      }
    });

    li.appendChild(deleteBtn);

    li.appendChild(document.createTextNode(filePath));

    li.addEventListener('click', async () => {
      await window.api.logFilePath(filePath);
      window.api.openFile(filePath);
    });

    li.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.api.openLocation(filePath);
    });

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
  return await window.api.loadSettings();
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
  const watchFolder = document.getElementById('selected-folder-path').textContent;
  const listSubfolders = document.getElementById('list-subfolders').checked;
  const categories = getCategories();
  if (watchFolder) {
    window.api.getFiles(watchFolder, categories, listSubfolders).then(files => {
      displayFiles(files, categories, listSubfolders);
      updateElementCount(files.all.length);
    });
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
