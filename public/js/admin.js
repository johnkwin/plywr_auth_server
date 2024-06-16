document.addEventListener('DOMContentLoaded', () => {
    const userList = document.getElementById('userList');
    const searchUsers = document.getElementById('searchUsers');
    const newUserEmail = document.getElementById('newUserEmail');
    const newUserPassword = document.getElementById('newUserPassword');
    const saveNewUser = document.getElementById('saveNewUser');

    // Handle user search
    searchUsers.addEventListener('input', handleSearch);

    // Save new user
    saveNewUser.addEventListener('click', createNewUser);

    async function handleSearch() {
        const query = searchUsers.value.trim();
        if (query === '') {
            clearUserList();
            document.getElementById('newUserForm').style.display = 'block';
            return;
        }

        document.getElementById('newUserForm').style.display = 'none';
        try {
            const response = await fetch(`/admin/search-users?q=${query}`);
            if (response.ok) {
                const users = await response.json();
                populateUserList(users);
            }
        } catch (error) {
            console.error('Error searching users:', error);
        }
    }

    async function createNewUser() {
        const email = newUserEmail.value.trim();
        const password = newUserPassword.value.trim();
        if (!email || !password) return;

        try {
            const response = await fetch('/admin/user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            if (response.ok) {
                newUserEmail.value = '';
                newUserPassword.value = '';
                searchUsers.value = '';
                handleSearch();
            } else {
                console.error('Error creating new user');
            }
        } catch (error) {
            console.error('Error creating new user:', error);
        }
    }

    function populateUserList(users) {
        clearUserList();
        users.forEach(user => {
            const listItem = document.createElement('div');
            listItem.className = 'user-list-item';
            listItem.innerHTML = `
                <input type="text" value="${user.email}" readonly>
                <button class="toggle-button ${user.isAdmin ? 'active' : ''}" data-userid="${user._id}">${user.isAdmin ? 'On' : 'Off'}</button>
                <select data-userid="${user._id}">
                    <option value="active" ${user.subscriptionStatus === 'active' ? 'selected' : ''}>Active</option>
                    <option value="inactive" ${user.subscriptionStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                </select>
                <button class="confirm-changes-button" data-userid="${user._id}">Confirm Changes</button>
            `;

            listItem.querySelector('.toggle-button').addEventListener('click', toggleAdmin);
            listItem.querySelector('select').addEventListener('change', markChanged);
            listItem.querySelector('.confirm-changes-button').addEventListener('click', confirmChanges);
            userList.appendChild(listItem);
        });
    }

    function clearUserList() {
        userList.innerHTML = `
            <div class="user-list-header">
                <span>Email</span>
                <span>Admin</span>
                <span>Subscription Status</span>
                <span>Actions</span>
            </div>`;
    }

    function toggleAdmin(event) {
        const button = event.currentTarget;
        button.classList.toggle('active');
        button.textContent = button.classList.contains('active') ? 'On' : 'Off';
        markChanged(button);
    }

    function markChanged(event) {
        const listItem = event.currentTarget.closest('.user-list-item');
        const confirmButton = listItem.querySelector('.confirm-changes-button');
        confirmButton.classList.add('visible');
    }

    async function confirmChanges(event) {
        const button = event.currentTarget;
        const listItem = button.closest('.user-list-item');
        const userId = button.getAttribute('data-userid');
        const isAdmin = listItem.querySelector('.toggle-button').classList.contains('active');
        const subscriptionStatus = listItem.querySelector('select').value;

        try {
            const response = await fetch(`/admin/user/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isAdmin, subscriptionStatus })
            });

            if (response.ok) {
                button.classList.remove('visible');
            } else {
                console.error('Failed to update user');
            }
        } catch (error) {
            console.error('Error updating user:', error);
        }
    }
});
