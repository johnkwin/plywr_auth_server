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
                    if (!response.ok) {
                        return response.json().then(data => { throw new Error(data.message); });
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        console.log('User added:', data);
                        newUserEmail.value = '';
                        newUserPassword.value = '';
                        newUserForm.style.display = 'none';
                        handleSearch({ target: { value: '' } });
                    } else {
                        console.error('Error adding user:', data);
                    }
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
        userList.addEventListener('click', function (event) {
            handleUserChange(event);
            if (event.target.matches('.confirm-changes-button')) {
                confirmChanges(event.target);
            }
        });
        userList.addEventListener('change', handleUserChange);
    }

    function handleSearch(event) {
        const query = event.target.value;
        if (query.trim() === '') {
            userList.innerHTML = '';
            newUserForm.style.display = 'block';
            return;
        }

        fetch(`/admin/search-users?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(users => {
                userList.innerHTML = '';
                newUserForm.style.display = 'none';

                users.forEach(user => {
                    const listItem = document.createElement('div');
                    listItem.className = 'user-list-item';
                    listItem.dataset.userid = user._id;
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

            const confirmButton = button.closest('.user-list-item').querySelector('.confirm-changes-button');
            confirmButton.style.display = 'inline-block';
        }
    }

    async function confirmChanges(button) {
        const listItem = button.closest('.user-list-item');
        const userId = listItem.dataset.userid;
        const email = listItem.querySelector('.user-email').value;
        const isAdmin = listItem.querySelector('.toggle-button').classList.contains('active');
        const subscriptionStatus = listItem.querySelector('.user-subscription-status').value;
        const password = listItem.querySelector('.user-password').value;
    
        try {
            const response = await fetch(`/admin/user/${userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, isAdmin, subscriptionStatus, password })
            });
    
            const result = await response.json();
    
            if (result.success) {
                alert('User updated successfully');
                button.classList.remove('show'); // Hide the confirm button after changes are confirmed
            } else {
                alert('Failed to update user');
            }
        } catch (error) {
            console.error('Error updating user:', error);
            alert('Failed to update user');
        }
    }
    
    // Event listener for the toggle admin button
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('toggle-button')) {
            toggleAdmin(event.target);
        }
    });
    
    // Event listener for changes in the input fields
    document.addEventListener('input', (event) => {
        if (event.target.classList.contains('user-email') ||
            event.target.classList.contains('user-subscription-status') ||
            event.target.classList.contains('user-password')) {
            markChanged(event.target);
        }
    });
    
    // Function to mark a change and show the confirm button
    function markChanged(input) {
        const listItem = input.closest('.user-list-item');
        listItem.querySelector('.confirm-changes-button').classList.add('show');
    }
    
    // Function to handle the toggle admin button
    function toggleAdmin(button) {
        button.classList.toggle('active');
        button.classList.toggle('inactive');
        button.textContent = button.classList.contains('active') ? 'On' : 'Off';
        markChanged(button);
    }
    
    // Function to handle user search
    async function handleSearch(event) {
        const query = event.target.value;
        const userList = document.querySelector('.user-list');
    
        if (query.length === 0) {
            userList.innerHTML = ''; // Clear the list if search input is empty
            document.querySelector('.new-user-form').style.display = 'flex'; // Show the new user form
            return;
        }
    
        try {
            const response = await fetch(`/admin/search-users?q=${query}`);
            const users = await response.json();
    
            userList.innerHTML = users.map(user => `
                <div class="user-list-item" data-userid="${user._id}">
                    <input type="text" class="user-email" value="${user.email}">
                    <button class="toggle-button ${user.isAdmin ? 'active' : 'inactive'}">${user.isAdmin ? 'On' : 'Off'}</button>
                    <select class="user-subscription-status">
                        <option value="active" ${user.subscriptionStatus === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${user.subscriptionStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                    <input type="password" class="user-password" placeholder="New password (optional)">
                    <button class="confirm-changes-button" onclick="confirmChanges(this)">Confirm Changes</button>
                </div>
            `).join('');
    
            document.querySelector('.new-user-form').style.display = 'none'; // Hide the new user form during search
        } catch (error) {
            console.error('Error searching users:', error);
        }
    }
    
    document.getElementById('search-input').addEventListener('input', handleSearch);
});
