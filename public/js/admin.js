document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search-users');
    const userList = document.getElementById('user-list');
    const newUserForm = document.querySelector('.new-user-form');
    const saveNewUserButton = document.getElementById('save-new-user');

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
                        <button class="toggle-button ${user.isAdmin ? 'active' : 'off'}" data-userid="${user._id}" onclick="toggleAdmin(this)">${user.isAdmin ? 'On' : 'Off'}</button>
                        <select data-userid="${user._id}" data-field="subscriptionStatus" onchange="markChanged(this)">
                            <option value="active" ${user.subscriptionStatus === 'active' ? 'selected' : ''}>Active</option>
                            <option value="inactive" ${user.subscriptionStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                        </select>
                        <button class="confirm-changes-button" data-userid="${user._id}" onclick="confirmChanges(this)">Confirm Changes</button>
                    `;
                    userList.appendChild(userItem);
                });
                newUserForm.style.display = 'none';
            })
            .catch(error => {
                console.error('Error searching users:', error);
            });
    }

    saveNewUserButton.addEventListener('click', createUser);

    function createUser() {
        const email = document.getElementById('new-user-email').value;
        const password = document.getElementById('new-user-password').value;
        const isAdmin = document.getElementById('new-user-admin').classList.contains('active');
        const subscriptionStatus = document.getElementById('new-user-subscription-status').value;

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

    window.toggleAdmin = function (button) {
        button.classList.toggle('active');
        button.classList.toggle('off');
        button.textContent = button.classList.contains('active') ? 'On' : 'Off';
        markChanged(button);
    };

    window.markChanged = function (element) {
        const userId = element.dataset.userid;
        const userItem = document.querySelector(`.user-list-item input[data-userid="${userId}"]`).closest('.user-list-item');
        const confirmButton = userItem.querySelector('.confirm-changes-button');
        confirmButton.style.display = 'block';
    };

    window.confirmChanges = function (button) {
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
    };
});
