document.addEventListener('DOMContentLoaded', () => {
    const userList = document.getElementById('userList');
    const searchUsers = document.getElementById('searchUsers');
    const newUserForm = document.getElementById('newUserForm');

    // Handle user search
    searchUsers.addEventListener('input', handleSearch);

    // Load users dynamically based on search input
    async function handleSearch() {
        const query = searchUsers.value.trim();
        if (query === '') {
            clearUserList();
            newUserForm.style.display = 'block';
            return;
        }

        newUserForm.style.display = 'none';
        const response = await fetch(`/admin/search-users?q=${query}`);
        if (response.ok) {
            const users = await response.json();
            populateUserList(users);
        }
    }

    // Populate user list
    function populateUserList(users) {
        clearUserList();
        users.forEach(user => {
            const listItem = document.createElement('div');
            listItem.className = 'user-list-item';
            listItem.innerHTML = `
                <input type="text" value="${user.email}" readonly>
                <button class="toggle-button ${user.isAdmin ? 'active' : ''}" data-userid="${user._id}" onclick="toggleAdmin(this)">${user.isAdmin ? 'On' : 'Off'}</button>
                <select data-userid="${user._id}" onchange="markChanged(this)">
                    <option value="active" ${user.subscriptionStatus === 'active' ? 'selected' : ''}>Active</option>
                    <option value="inactive" ${user.subscriptionStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                </select>
                <button class="confirm-changes-button" data-userid="${user._id}" onclick="confirmChanges(this)">Confirm Changes</button>
            `;
            userList.appendChild(listItem);
        });
    }

    // Clear user list
    function clearUserList() {
        userList.innerHTML = `
            <div class="user-list-header">
                <span>Email</span>
                <span>Admin</span>
                <span>Subscription Status</span>
                <span>Actions</span>
            </div>`;
    }

    // Toggle admin status
    window.toggleAdmin = (button) => {
        button.classList.toggle('active');
        button.textContent = button.classList.contains('active') ? 'On' : 'Off';
        markChanged(button);
    };

    // Mark a user as changed
    window.markChanged = (element) => {
        const confirmButton = element.parentNode.querySelector('.confirm-changes-button');
        confirmButton.classList.add('visible');
    };

    // Confirm changes
    window.confirmChanges = async (button) => {
        const userId = button.getAttribute('data-userid');
        const listItem = button.parentNode;
        const isAdmin = listItem.querySelector('.toggle-button').classList.contains('active');
        const subscriptionStatus = listItem.querySelector('select').value;

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
    };
});
