document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-users');
    const userList = document.getElementById('user-list');
    const newUserForm = document.querySelector('.new-user-form');
    const newUserAdmin = document.getElementById('new-user-admin');
    const saveNewUserButton = document.getElementById('save-new-user');

    searchInput.addEventListener('input', () => {
        handleSearch(searchInput.value);
    });

    newUserAdmin.addEventListener('click', () => {
        toggleNewUserAdmin(newUserAdmin);
    });

    saveNewUserButton.addEventListener('click', createUser);
});

function toggleAdmin(button) {
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

function markChanged(element) {
    const userItem = element.closest('.user-list-item');
    if (userItem) {
        userItem.classList.add('changed');
        const confirmButton = userItem.querySelector('.confirm-changes-button');
        if (confirmButton) {
            confirmButton.style.display = 'inline-block';
        }
    }
}

function confirmChanges(button) {
    const userId = button.dataset.userid;
    const userItem = button.closest('.user-list-item');
    const isAdmin = userItem.querySelector('.toggle-button').classList.contains('active');
    const subscriptionStatus = userItem.querySelector('select').value;
    const newPassword = userItem.querySelector('input[type="password"]').value;

    const body = { id: userId, isAdmin, subscriptionStatus };
    if (newPassword) {
        body.password = newPassword;
    }

    fetch('/admin/update-user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    })
    .then(response => response.text())
    .then(data => {
        console.log('User updated:', data);
        userItem.classList.remove('changed');
        button.style.display = 'none';
        // Keep the password field content after update
        // userItem.querySelector('input[type="password"]').value = '';
    })
    .catch(error => {
        console.error('Error updating user:', error);
    });
}

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
                    <input type="password" placeholder="New Password">
                    <button class="toggle-button ${user.isAdmin ? 'active' : 'off'}" data-userid="${user._id}">On</button>
                    <select data-userid="${user._id}">
                        <option value="active" ${user.subscriptionStatus === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${user.subscriptionStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                    <button class="confirm-changes-button" data-userid="${user._id}">Confirm Changes</button>
                `;
                userList.appendChild(listItem);

                // Attach event listeners
                listItem.querySelector('.toggle-button').addEventListener('click', (e) => toggleAdmin(e.target));
                listItem.querySelector('input[type="password"]').addEventListener('input', (e) => markChanged(e.target));
                listItem.querySelector('select').addEventListener('change', (e) => markChanged(e.target));
                listItem.querySelector('.confirm-changes-button').addEventListener('click', (e) => confirmChanges(e.target));
            });
        })
        .catch(error => {
            console.error('Error searching users:', error);
        });
}

function createUser() {
    const email = document.getElementById('new-user-email').value;
    const password = document.getElementById('new-user-password').value;
    const isAdmin = document.getElementById('new-user-admin').classList.contains('active');
    const subscriptionStatus = document.getElementById('new-user-subscription-status').value;

    fetch('/admin/user', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, isAdmin, subscriptionStatus })
    })
    .then(response => response.text())
    .then(data => {
        console.log('User created:', data);
        handleSearch('');
    })
    .catch(error => {
        console.error('Error creating user:', error);
    });
}
