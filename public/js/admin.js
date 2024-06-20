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
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        console.log('User added:', data);
                        newUserEmail.value = '';
                        newUserPassword.value = '';
                        //newUserForm.style.display = 'none';
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
            newUserForm.style.display = 'flex';
            return;
        }

        fetch(`/admin/search-users?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(users => {
                userList.innerHTML = '';
                //newUserForm.style.display = 'none';

                users.forEach(user => {
                    const listItem = document.createElement('div');
                    listItem.className = 'user-list-item';
                    listItem.dataset.userid = user._id;
                    console.log("User isAdmin:", user.isAdmin);
                    console.log("User subscriptionStatus:", user.subscriptionStatus);
                    console.log("User email:", user.email);
                    console.log("User _id:", user._id);
                    console.log("User _id:", user.password);
                    console.log("User createdAt:", user.createdAt);

                    listItem.innerHTML = `
                        <input type="text" value="${user.email}">
                         <input type="password" data-userid="${user._id}" value="" placeholder="Update Password">
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
        const listItem = event.target.closest('.user-list-item');
        if (!listItem) return;

        const confirmButton = listItem.querySelector('.confirm-changes-button');
        const emailInput = listItem.querySelector('input[type="text"]');
        const passwordInput = listItem.querySelector('input[type="password"]');
        const isAdminButton = listItem.querySelector('.toggle-button');
        const subscriptionSelect = listItem.querySelector('select');

        const emailChanged = emailInput && emailInput.value !== emailInput.dataset.original;
        const passwordChanged = passwordInput && passwordInput.value.trim() !== '';

        if (emailChanged || passwordChanged || event.target === isAdminButton || event.target === subscriptionSelect) {
            confirmButton.style.display = 'inline-block';
        } else {
            confirmButton.style.display = 'none';
        }
    }

    function confirmChanges(button) {
        const listItem = button.closest('.user-list-item');
        const userId = listItem.dataset.userid;
        const emailInput = listItem.querySelector('input[type="text"]');
        const isAdminButton = listItem.querySelector('.toggle-button');
        const subscriptionSelect = listItem.querySelector('select');
        const isAdmin = isAdminButton.classList.contains('active');
        const subscriptionStatus = subscriptionSelect.value;
        const password = listItem.querySelector('input[type="password"]').value.trim();
        const email = emailInput.value.trim();

        if (!userId || !/^[a-fA-F0-9]{24}$/.test(userId)) {
            alert('Invalid User ID');
            return;
        }

        const handleResponse = async (response) => {
            console.log('Full Response:', response);
            const contentType = response.headers.get('content-type');
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }
            if (contentType && contentType.includes('application/json')) {
                return response.json();
            }
            return response.text();
        };

        if (subscriptionStatus === 'delete') {
            fetch(`/admin/user/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            .then(handleResponse)
            .then(data => {
                if (typeof data === 'string') {
                    console.log('Response as text:', data);
                    alert(data); // Handle text response
                } else if (data.success) {
                    listItem.remove();
                } else {
                    console.error('Error deleting user:', data);
                    alert('Error deleting user');
                }
            })
            .catch(error => {
                console.error('Error deleting user:', error);
                alert('Error deleting user');
            });
        } else {
            const id = userId;
            if (password) bodyData.password = password;
            const bodyData = { id, email, isAdmin, subscriptionStatus }
            console.log(JSON.stringify(bodyData));
            fetch(`/admin/update-user`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ id, email, isAdmin, subscriptionStatus })
            })
            .then(handleResponse)
            .then(data => {
                if (data === "User updated" || data.success) {
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
    }
});
