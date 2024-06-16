document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search');
    const userForm = document.getElementById('user-form');
    const userList = document.getElementById('user-list');

    searchInput.addEventListener('input', handleSearch);

    async function handleSearch() {
        const query = searchInput.value.trim();

        if (query === '') {
            userList.innerHTML = '';
            userForm.style.display = 'block';
            return;
        }

        try {
            const response = await fetch(`/admin/search-users?q=${query}`);
            const users = await response.json();

            userList.innerHTML = '';
            userForm.style.display = 'none';

            users.forEach(user => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${user.email}</span>
                    <input type="checkbox" ${user.isAdmin ? 'checked' : ''} data-id="${user._id}" class="admin-toggle">
                    <select data-id="${user._id}" class="subscription-status">
                        <option value="active" ${user.subscriptionStatus === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${user.subscriptionStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                    <button class="confirm-button" data-id="${user._id}" style="display:none;">Confirm Changes</button>
                `;
                userList.appendChild(li);
            });

            document.querySelectorAll('.admin-toggle').forEach(toggle => {
                toggle.addEventListener('change', handleAdminToggle);
            });

            document.querySelectorAll('.subscription-status').forEach(select => {
                select.addEventListener('change', handleSubscriptionChange);
            });

            document.querySelectorAll('.confirm-button').forEach(button => {
                button.addEventListener('click', handleConfirmChanges);
            });
        } catch (error) {
            console.error('Error searching users:', error);
        }
    }

    async function handleAdminToggle(event) {
        const checkbox = event.target;
        const userId = checkbox.dataset.id;
        const isAdmin = checkbox.checked;

        const confirmButton = checkbox.nextElementSibling.nextElementSibling;
        confirmButton.style.display = 'inline-block';

        checkbox.dataset.isadmin = isAdmin;
    }

    async function handleSubscriptionChange(event) {
        const select = event.target;
        const userId = select.dataset.id;
        const subscriptionStatus = select.value;

        const confirmButton = select.nextElementSibling;
        confirmButton.style.display = 'inline-block';

        select.dataset.subscriptionstatus = subscriptionStatus;
    }

    async function handleConfirmChanges(event) {
        const button = event.target;
        const userId = button.dataset.id;
        const isAdmin = document.querySelector(`.admin-toggle[data-id="${userId}"]`).dataset.isadmin === 'true';
        const subscriptionStatus = document.querySelector(`.subscription-status[data-id="${userId}"]`).dataset.subscriptionstatus;

        try {
            await fetch(`/admin/user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: userId,
                    isAdmin,
                    subscriptionStatus
                })
            });

            button.style.display = 'none';
            alert('Changes saved successfully.');
        } catch (error) {
            console.error('Error saving changes:', error);
        }
    }
});
