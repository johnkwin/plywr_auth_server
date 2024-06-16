document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-users');
    const userList = document.getElementById('user-list');
    const newUserForm = document.querySelector('.new-user-form');
    const newUserAdmin = document.getElementById('new-user-admin');

    searchInput.addEventListener('input', () => {
        if (searchInput.value.length === 0) {
            userList.innerHTML = '';
            newUserForm.style.display = 'flex';
        } else {
            handleSearch(searchInput.value);
        }
    });

    newUserAdmin.addEventListener('click', () => {
        toggleNewUserAdmin(newUserAdmin);
    });
});

// Toggle admin status
function toggleAdmin(button) {
    const userId = button.dataset.userid;
    const isAdmin = button.classList.contains('active');

    if (isAdmin) {
        button.classList.remove('active');
        button.classList.add('off');
        button.textContent = 'Off';
    } else {
        button.classList.remove('off');
        button.classList.add('active');
        button.textContent = 'On';
    }
    markChanged(button);
}

// Toggle new user admin status
function toggleNewUserAdmin(button) {
    if (button.classList.contains('active')) {
        button.classList.remove('active');
        button.classList.add('off');
        button.textContent = 'Off';
    } else {
        button.classList.remove('off');
        button.classList.add('active');
        button.textContent = 'On';
    }
}

// Mark user as changed
function markChanged(element) {
    const userItem = element.closest('.user-list-item');
    if (userItem) {
        userItem.classList.add('changed');
    }
}

// Confirm changes
function confirmChanges(button) {
    const userId = button.dataset.userid;
    const userItem = button.closest('.user-list-item');
    const isAdmin = userItem.querySelector('.toggle-button').classList.contains('active');
    const subscriptionStatus = userItem.querySelector('select').value;

    fetch('/admin/update-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: userId, isAdmin, subscriptionStatus })
    })
    .then(response => response.text())
    .then(data => {
        console.log('User updated:', data);
        userItem.classList.remove('changed');
        button.style.display = 'none';
    })
    .catch(error => {
        console.error('Error updating user:', error);
    });
}

// Handle search input
function handleSearch(query) {
    const userForm = document.querySelector('.new-user-form');
    const userList = document.getElementById('user-list');
    if (query.length === 0) {
        userForm.style.display = 'flex';
        userList.innerHTML = '';
        return;
    }

    userForm.style.display = 'none';

    fetch(`/admin/search-users?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(users => {
            userList.innerHTML = '';
            users.forEach(user => {
                const listItem = document.createElement('li');
                listItem.classList.add('user-list-item');
                listItem.innerHTML = `
                    <input type="text" value="${user.email}" readonly>
                    <button class="toggle-button ${user.isAdmin ? 'active' : 'off'}" data-userid="${user._id}">${user.isAdmin ? 'On' : 'Off'}</button>
                    <select data-userid="${user._id}" onchange="markChanged(this)">
                        <option value="active" ${user.subscriptionStatus === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${user.subscriptionStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                    <button class="confirm-changes-button" data-userid="${user._id}" onclick="confirmChanges(this)">Confirm Changes</button>
                `;
                userList.appendChild(listItem);
            });
        })
        .catch(error => {
            console.error('Error searching users:', error);
        });
}

// Create new user
function createUser() {
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-password').value;
    const isAdmin = document.getElementById('new-user-admin').classList.contains('active');
    const subscriptionStatus = document.getElementById('new-user-subscription').value;

    fetch('/admin/user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, isAdmin, subscriptionStatus })
    })
    .then(response => response.text())
    .then(data => {
        console.log('User created:', data);
        // Optionally refresh the list or reset the form
    })
    .catch(error => {
        console.error('Error creating user:', error);
    });
}

// Initial display setup
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-users');
    const userList = document.getElementById('user-list');
    const newUserForm = document.querySelector('.new-user-form');
    
    searchInput.addEventListener('input', () => {
        if (searchInput.value.length === 0) {
            userList.innerHTML = '';
            newUserForm.style.display = 'flex';
        } else {
            handleSearch(searchInput.value);
        }
    });
});
