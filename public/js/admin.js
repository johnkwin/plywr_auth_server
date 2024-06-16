document.addEventListener('DOMContentLoaded', function () {
    const searchUsers = document.getElementById('searchUsers');
    const userList = document.getElementById('userList');
    const saveNewUserButton = document.getElementById('saveNewUser');
    const newUserEmail = document.getElementById('newUserEmail');
    const newUserPassword = document.getElementById('newUserPassword');
    const newUserForm = document.getElementById('newUserForm');
    let changesToConfirm = {}; // Track changes to confirm

    function handleSearch(event) {
        const query = event.target.value;
        if (query.trim() === '') {
            userList.innerHTML = ''; // Clear list if query is empty
            newUserForm.style.display = 'block'; // Show new user form
            return;
        }

        fetch(`/admin/search-users?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(users => {
                userList.innerHTML = ''; // Clear the list before updating
                newUserForm.style.display = 'none'; // Hide new user form

                users.forEach(user => {
                    const listItem = document.createElement('div');
                    listItem.className = 'user-list-item';
                    listItem.innerHTML = `
                        <input type="text" value="${user.email}" readonly>
                        <button class="toggle-button ${user.isAdmin ? 'active' : 'off'}" data-userid="${user._id}">${user.isAdmin ? 'On' : 'Off'}</button>
                        <select data-userid="${user._id}" onchange="handleUserChange(this)">
                            <option value="active" ${user.subscriptionStatus === 'active' ? 'selected' : ''}>Active</option>
                            <option value="inactive" ${user.subscriptionStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                            <option value="delete" class="delete-option">Delete</option>
                        </select>
                        <button class="confirm-changes-button" data-userid="${user._id}" style="display: none;">Confirm Changes</button>
                    `;
                    userList.appendChild(listItem);
                });
            })
            .catch(error => console.error('Error searching users:', error));
    }

    function handleUserChange(selectElement) {
        const userId = selectElement.getAttribute('data-userid');
        const confirmButton = selectElement.nextElementSibling;
        if (!confirmButton) return;
        
        if (selectElement.value === 'delete') {
            confirmButton.textContent = 'Confirm Deletion';
            confirmButton.classList.add('confirm-deletion');
        } else {
            confirmButton.textContent = 'Confirm Changes';
            confirmButton.classList.remove('confirm-deletion');
        }
        confirmButton.style.display = 'inline-block';
    }

    function confirmChanges(button) {
        const userId = button.getAttribute('data-userid');
        const listItem = button.closest('.user-list-item');
        const isAdminButton = listItem.querySelector('.toggle-button');
        const subscriptionSelect = listItem.querySelector('select');
        const isAdmin = isAdminButton.classList.contains('active');
        const subscriptionStatus = subscriptionSelect.value;

        if (subscriptionStatus === 'delete') {
            fetch(`/admin/user/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id: userId })
            })
            .then(response => {
                if (response.ok) {
                    listItem.remove(); // Remove the user from the list
                } else {
                    console.error('Error deleting user:', response);
                }
            })
            .catch(error => console.error('Error deleting user:', error));
        } else {
            fetch(`/admin/update-user/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ isAdmin, subscriptionStatus })
            })
            .then(response => {
                if (response.ok) {
                    button.style.display = 'none'; // Hide confirm button
                } else {
                    console.error('Error updating user:', response);
                }
            })
            .catch(error => console.error('Error updating user:', error));
        }
    }

    searchUsers.addEventListener('input', handleSearch);

    saveNewUserButton.addEventListener('click', function () {
        const email = newUserEmail.value.trim();
        const password = newUserPassword.value.trim();
        const isAdmin = document.getElementById('new-user-admin').classList.contains('active');
        const subscriptionStatus = document.getElementById('new-user-subscription-status').value;

        fetch('/admin/user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password, isAdmin, subscriptionStatus })
        })
        .then(response => response.ok ? response.json() : Promise.reject(response))
        .then(() => {
            newUserEmail.value = '';
            newUserPassword.value = '';
        })
        .catch(error => console.error('Error saving new user:', error));
    });

    document.getElementById('userList').addEventListener('click', function (event) {
        if (event.target.classList.contains('toggle-button')) {
            toggleAdmin(event.target);
        } else if (event.target.classList.contains('confirm-changes-button')) {
            confirmChanges(event.target);
        }
    });

    function toggleAdmin(button) {
        button.classList.toggle('active');
        button.classList.toggle('off');
        button.textContent = button.classList.contains('active') ? 'On' : 'Off';
        const confirmButton = button.closest('.user-list-item').querySelector('.confirm-changes-button');
        confirmButton.style.display = 'inline-block';
    }
});
