document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchUsers');
    const userList = document.querySelector('.user-list-items');
    const newUserForm = document.getElementById('newUserForm');
    const saveNewUserButton = document.getElementById('saveNewUser');
    const newUserAdminButton = document.getElementById('newUserAdmin');

    // Handle search
    searchInput.addEventListener('input', handleSearch);

    function handleSearch() {
        const query = searchInput.value.trim();
        if (query === '') {
            userList.innerHTML = '';
            newUserForm.style.display = 'block';
            return;
        }
        fetch(`/admin/search-users?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(users => {
                userList.innerHTML = '';
                users.forEach(user => {
                    const userItem = document.createElement('li');
                    userItem.className = 'user-list-item';
                    userItem.innerHTML = `
                        <input type="text" value="${user.email}" data-userid="${user._id}" data-field="email" readonly>
                        <button class="toggle-button ${user.isAdmin ? 'active' : 'off'}" data-userid="${user._id}">${user.isAdmin ? 'On' : 'Off'}</button>
                        <select data-userid="${user._id}" data-field="subscriptionStatus">
                            <option value="active" ${user.subscriptionStatus === 'active' ? 'selected' : ''}>Active</option>
                            <option value="inactive" ${user.subscriptionStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                        </select>
                        <button class="confirm-changes-button" data-userid="${user._id}">Confirm Changes</button>
                    `;
                    userList.appendChild(userItem);
                });
                newUserForm.style.display = 'none';
                attachEventListeners();
            })
            .catch(error => {
                console.error('Error searching users:', error);
            });
    }

    saveNewUserButton.addEventListener('click', createUser);
    newUserAdminButton.addEventListener('click', function () {
        toggleAdminButton(newUserAdminButton);
    });

    function createUser() {
        const email = document.getElementById('newUserEmail').value;
        const password = document.getElementById('newUserPassword').value;
        const isAdmin = newUserAdminButton.classList.contains('active');
        const subscriptionStatus = document.getElementById('newUserSubscriptionStatus').value;

        fetch('/admin/user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password, isAdmin, subscriptionStatus })
        })
            .then(response => response.json())
            .then(() => {
                handleSearch();
            })
            .catch(error => {
                console.error('Error creating user:', error);
            });
    }

    function toggleAdminButton(button) {
        button.classList.toggle('active');
        button.classList.toggle('off');
        button.textContent = button.classList.contains('active') ? 'On' : 'Off';
    }

    function attachEventListeners() {
        document.querySelectorAll('.toggle-button').forEach(button => {
            button.addEventListener('click', function () {
                toggleAdminButton(button);
                markChanged(button);
            });
        });

        document.querySelectorAll('.user-list-item select').forEach(select => {
            select.addEventListener('change', function () {
                markChanged(select);
            });
        });

        document.querySelectorAll('.confirm-changes-button').forEach(button => {
            button.addEventListener('click', function () {
                confirmChanges(button);
            });
        });
    }

    function markChanged(element) {
        const userId = element.dataset.userid;
        const userItem = document.querySelector(`.user-list-item input[data-userid="${userId}"]`).closest('.user-list-item');
        const confirmButton = userItem.querySelector('.confirm-changes-button');
        confirmButton.style.display = 'block';
    }

    function confirmChanges(button) {
        const userId = button.dataset.userid;
        const userItem = document.querySelector(`.user-list-item input[data-userid="${userId}"]`).closest('.user-list-item');
        const email = userItem.querySelector('input[data-field="email"]').value;
        const isAdmin = userItem.querySelector('.toggle-button').classList.contains('active');
        const subscriptionStatus = userItem.querySelector('select[data-field="subscriptionStatus"]').value;

        fetch(`/admin/update-user/${userId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, isAdmin, subscriptionStatus })
        })
            .then(response => response.json())
            .then(() => {
                button.style.display = 'none';
            })
            .catch(error => {
                console.error('Error updating user:', error);
            });
    }
});
