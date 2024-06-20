document.addEventListener('DOMContentLoaded', function () {
    // DOM elements
    const searchUsers = document.getElementById('searchUsers');
    const userList = document.getElementById('userList');
    const saveNewUserButton = document.getElementById('saveNewUser');
    const newUserEmail = document.getElementById('newUserEmail');
    const newUserPassword = document.getElementById('newUserPassword');
    const newUserForm = document.getElementById('newUserForm');
    const newUserAdmin = document.getElementById('newUserAdmin');
    const newUserSubscriptionStatus = document.getElementById('newUserSubscriptionStatus');

    // Event listeners
    if (searchUsers) searchUsers.addEventListener('input', handleSearch);
    if (saveNewUserButton) saveNewUserButton.addEventListener('click', createNewUser);
    if (newUserAdmin) newUserAdmin.addEventListener('click', toggleAdminStatus);
    if (userList) userList.addEventListener('click', handleUserClick);
    if (userList) userList.addEventListener('change', handleUserChange);

    // Create new user
    function createNewUser() {
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
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('User added:', data);
                    newUserEmail.value = '';
                    newUserPassword.value = '';
                    handleSearch({ target: { value: '' } });
                } else {
                    console.error('Error adding user:', data);
                }
            })
            .catch(error => console.error('Error adding user:', error));
        } else {
            alert('Please fill out all fields.');
        }
    }

    // Toggle admin status
    function toggleAdminStatus() {
        newUserAdmin.classList.toggle('active');
        newUserAdmin.classList.toggle('off');
        newUserAdmin.textContent = newUserAdmin.classList.contains('active') ? 'On' : 'Off';
    }

    // Handle user actions
    function handleUserClick(event) {
        if (event.target.matches('.confirm-changes-button')) {
            confirmChanges(event.target);
        }
    }

    // Handle user changes
    function handleUserChange(event) {
        const listItem = event.target.closest('.user-list-item');
        if (!listItem) return;

        const confirmButton = listItem.querySelector('.confirm-changes-button');
        const emailInput = listItem.querySelector('input[type="text"]');
        const passwordInput = listItem.querySelector('input[type="password"]');
        const isAdminButton = listItem.querySelector('.toggle-button');
        const subscriptionSelect = listItem.querySelector('select');

        const emailChanged = emailInput && emailInput.value !== emailInput.dataset.original;
        const passwordChanged = passwordInput && passwordInput.value.trim() !== '';
        const adminChanged = isAdminButton && isAdminButton.textContent !== (isAdminButton.classList.contains('active') ? 'On' : 'Off');
        const subscriptionChanged = subscriptionSelect && subscriptionSelect.value !== subscriptionSelect.dataset.original;

        if (emailChanged || passwordChanged || adminChanged || subscriptionChanged) {
            confirmButton.style.display = 'inline-block';
        } else {
            confirmButton.style.display = 'none';
        }
    }

    // Confirm user changes
    function confirmChanges(button) {
        const listItem = button.closest('.user-list-item');
        const userId = listItem.dataset.userid;
        const emailInput = listItem.querySelector('input[type="text"]');
        const passwordInput = listItem.querySelector('input[type="password"]');
        const isAdminButton = listItem.querySelector('.toggle-button');
        const subscriptionSelect = listItem.querySelector('select');
        const isAdmin = isAdminButton.classList.contains('active');
        const subscriptionStatus = subscriptionSelect.value;
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        const bodyData = { email, isAdmin, subscriptionStatus };
        if (password) bodyData.password = password;

        fetch(`/admin/update-user/${userId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bodyData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                button.style.display = 'none';
                console.log('User updated successfully:', data);
            } else {
                console.error('Error updating user:', data);
                alert('Error updating user');
            }
        })
        .catch(error => {
            console.error('Error updating user:', error);
            alert('Error updating user');
        });
    }

    // Handle search
    function handleSearch(event) {
        const query = event.target.value;
        if (query.trim() === '') {
            userList.innerHTML = '';
            newUserForm.style.display = 'flex';
            return;
        }

        fetch(`/admin/search-users?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(users => {
                userList.innerHTML = '';
                users.forEach(user => {
                    const listItem = document.createElement('div');
                    listItem.className = 'user-list-item';
                    listItem.dataset.userid = user._id;

                    listItem.innerHTML = `
                        <input type="text" value="${user.email}" data-original="${user.email}">
                        <input type="password" data-userid="${user._id}" value="" placeholder="Update Password">
                        <button class="toggle-button ${user.isAdmin ? 'active' : 'off'}">${user.isAdmin ? 'On' : 'Off'}</button>
                        <select data-userid="${user._id}" data-original="${user.subscriptionStatus}">
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
});
