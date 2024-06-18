document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const userForm = document.getElementById('user-form');
    const userList = document.getElementById('user-list');
    const confirmButtons = document.getElementsByClassName('confirm-changes-button');
    const logoutButton = document.getElementById('logout-button');

    // Toggle Admin Status
    async function toggleAdmin(button) {
        const userId = button.getAttribute('data-userid');
        const isAdmin = button.classList.contains('active');
        const newStatus = !isAdmin;
        
        const response = await fetch(`/admin/user/${userId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ isAdmin: newStatus })
        });

        if (response.ok) {
            button.classList.toggle('active');
            button.textContent = newStatus ? 'On' : 'Off';
        } else {
            console.error('Failed to update admin status');
        }
    }

    // Handle Confirm Changes
    async function confirmChanges(button) {
        const userId = button.getAttribute('data-userid');
        const emailInput = document.querySelector(`input[data-userid='${userId}']`);
        const isAdmin = document.querySelector(`button[data-userid='${userId}']`).classList.contains('active');
        const subscriptionStatus = document.querySelector(`select[data-userid='${userId}']`).value;

        const response = await fetch(`/admin/user/${userId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: emailInput.value,
                isAdmin,
                subscriptionStatus
            })
        });

        if (response.ok) {
            console.log('User updated successfully');
            button.style.display = 'none'; // Hide button after confirming changes
        } else {
            console.error('Failed to update user');
        }
    }

    // Mark Field as Changed
    function markChanged(element) {
        const userId = element.getAttribute('data-userid');
        const confirmButton = document.querySelector(`.confirm-changes-button[data-userid='${userId}']`);
        confirmButton.style.display = 'inline-block'; // Show confirm button
    }

    // Handle Search
    async function handleSearch() {
        const query = searchInput.value;
        const response = await fetch(`/admin/search-users?q=${query}`);
        
        if (response.ok) {
            const users = await response.json();
            userList.innerHTML = '';

            users.forEach(user => {
                const listItem = document.createElement('div');
                listItem.className = 'user-list-item';
                listItem.innerHTML = `
                    <input type="text" data-userid="${user._id}" value="${user.email}" readonly>
                    <button class="toggle-button ${user.isAdmin ? 'active' : ''}" data-userid="${user._id}" onclick="toggleAdmin(this)">${user.isAdmin ? 'On' : 'Off'}</button>
                    <select data-userid="${user._id}" onchange="markChanged(this)">
                        <option value="active" ${user.subscriptionStatus === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${user.subscriptionStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                    <button class="confirm-changes-button" data-userid="${user._id}" onclick="confirmChanges(this)" style="display:none;">Confirm Changes</button>
                `;
                userList.appendChild(listItem);
            });
        } else {
            console.error('Error searching users');
        }
    }

    // Event Listeners
    searchInput.addEventListener('input', handleSearch);

    // Add new user
    userForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(userForm);
        const data = Object.fromEntries(formData.entries());

        const response = await fetch('/admin/user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            console.log('User added or updated successfully');
            handleSearch(); // Refresh the user list
        } else {
            console.error('Failed to add or update user');
        }
    });

    // Ensure correct scope for functions
    window.toggleAdmin = toggleAdmin;
    window.confirmChanges = confirmChanges;
    window.markChanged = markChanged;
});
