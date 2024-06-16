document.addEventListener('DOMContentLoaded', function () {
    const searchUsers = document.getElementById('searchUsers');
    const userList = document.getElementById('userList');
    const saveNewUserButton = document.getElementById('saveNewUser');
    const newUserEmail = document.getElementById('newUserEmail');
    const newUserPassword = document.getElementById('newUserPassword');
    const newUserForm = document.getElementById('newUserForm');
    const newUserAdmin = document.getElementById('newUserAdmin');
    const newUserSubscriptionStatus = document.getElementById('newUserSubscriptionStatus');

    if (searchUsers) {
        searchUsers.addEventListener('input', handleSearch);
    }

    if (saveNewUserButton) {
        saveNewUserButton.addEventListener('click', function () {
            const email = newUserEmail.value.trim();
            const password = newUserPassword.value.trim();
            const isAdmin = newUserAdmin.classList.contains('active');
            const subscriptionStatus = newUserSubscriptionStatus.value;

            if (email && password) {
                fetch('/admin/user', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password, isAdmin, subscriptionStatus })
                })
                .then(response => {
                    if (response.ok) {
                        return response.json(); // Properly parse JSON
                    } else {
                        console.error('Error adding user:', response);
                        throw new Error('Error adding user');
                    }
                })
                .then(data => {
                    console.log('User added:', data);
                    newUserEmail.value = '';
                    newUserPassword.value = '';
                    newUserForm.style.display = 'none'; // Hide the form after adding a user
                    handleSearch({ target: { value: '' } }); // Refresh user list
                })
                .catch(error => console.error('Error adding user:', error));
            } else {
                alert('Please fill out all fields.');
            }
        });
    }

    if (newUserAdmin) {
        newUserAdmin.addEventListener('click', function () {
            newUserAdmin.classList.toggle('active');
            newUserAdmin.classList.toggle('off');
            newUserAdmin.textContent = newUserAdmin.classList.contains('active') ? 'On' : 'Off';
        });
    }

    if (userList) {
        userList.addEventListener('click', handleUserChange);
        userList.addEventListener('change', handleUserChange);
        userList.addEventListener('click', confirmChanges);
    }

    function handleSearch(event) {
        const query = event.target.value;
        if (query.trim() === '') {
            userList.innerHTML = ''; // Clear list if query is empty
            newUserForm.style.display = 'block'; // Show new user form
            return;
        }

        fetch(`/admin/search-users?q=${encodeURIComponent(query)}`)
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    console.error('Error searching users:', response);
                    throw new Error('Error searching users');
                }
            })
            .then(users => {
                userList.innerHTML = ''; // Clear the list before updating
                newUserForm.style.display = 'none'; // Hide new user form

                users.forEach(user => {
                    const listItem = document.createElement('div');
                    listItem.className = 'user-list-item';
                    listItem.dataset.userid = user._id; // Add user ID to dataset
                    listItem.innerHTML = `
                        <input type="text" value="${user.email}" readonly>
                        <button class="toggle-button ${user.isAdmin ? 'active' : 'off'}">${user.isAdmin ? 'On' : 'Off'}</button>
                        <select data-userid="${user._id}">
                            <option value="active" ${user.subscriptionStatus === 'active' ? 'selected' : ''}>Active</option>
                            <option value="inactive" ${user.subscriptionStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                            <option value="delete" class="delete-option">Delete</option>
                        </select>
                        <button class="confirm-changes-button" style="display: none;">Confirm Changes</button>
                    `;
                    userList.appendChild(listItem);
                });
            })
            .catch(error => console.error('Error searching users:', error));
    }

    function handleUserChange(event) {
        if (event.target.matches('select[data-userid]')) {
            const selectElement = event.target;
            const confirmButton = selectElement.nextElementSibling;

            if (selectElement.value === 'delete') {
                confirmButton.textContent = 'Confirm Deletion';
                confirmButton.classList.add('confirm-deletion');
            } else {
                confirmButton.textContent = 'Confirm Changes';
                confirmButton.classList.remove('confirm-deletion');
            }
            confirmButton.style.display = 'inline-block';
        } else if (event.target.matches('.toggle-button')) {
            const button = event.target;
            button.classList.toggle('active');
            button.classList.toggle('off');
            button.textContent = button.classList.contains('active') ? 'On' : 'Off';

            const confirmButton = button.nextElementSibling.nextElementSibling; // Find the confirm button
            confirmButton.style.display = 'inline-block'; // Show the confirm button
        }
    }

    function confirmChanges(event) {
        if (event.target.matches('.confirm-changes-button')) {
            const button = event.target;
            const listItem = button.closest('.user-list-item');
            const userId = listItem.dataset.userid;
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
    }
});
