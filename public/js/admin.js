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

function toggleAdmin(button) {
    const userId = button.dataset.userid;
    const isAdmin = button.classList.contains('active');

    button.classList.toggle('active');
    button.classList.toggle('off');
    button.textContent = isAdmin ? 'Off' : 'On';
    
    const userItem = button.closest('.user-list-item');
    markChanged(userItem);
}

function toggleNewUserAdmin(button) {
    button.classList.toggle('active');
    button.classList.toggle('off');
    button.textContent = button.classList.contains('active') ? 'On' : 'Off';
}

function markChanged(userItem) {
    userItem.classList.add('changed');
    const confirmButton = userItem.querySelector('.confirm-changes-button');
    confirmButton.style.display = 'inline-block';
}

function confirmChanges(button) {
    const userId = button.dataset.userid;
    const userItem = button.closest('.user-list-item');
    const isAdmin = userItem.querySelector('.toggle-button').classList.contains('active');
    const subscriptionStatus = userItem.querySelector('select').value;
    const email = userItem.querySelector('input[type="text"]').value;

    fetch(`/admin/update-user/${userId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, isAdmin, subscriptionStatus })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('User updated:', data.user); // Debugging
            userItem.classList.remove('changed');
            button.style.display = 'none';
        } else {
            console.error('Error updating user:', data.message);
        }
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
                    <button class="toggle-button ${user.isAdmin ? 'active' : 'off'}" data-userid="${user._id}">${user.isAdmin ? 'On' : 'Off'}</button>
                    <select data-userid="${user._id}" onchange="markChanged(this)">
                        <option value="active" ${user.subscriptionStatus === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${user.subscriptionStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                    <button class="confirm-changes-button" data-userid="${user._id}" onclick="confirmChanges(this)" style="display:none;">Confirm Changes</button>
                `;
                userList.appendChild(listItem);
            });

            document.querySelectorAll('.toggle-button').forEach(button => {
                button.addEventListener('click', () => toggleAdmin(button));
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
