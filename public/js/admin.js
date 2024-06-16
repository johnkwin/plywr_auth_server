document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search');
    const userForm = document.getElementById('new-user-form');
    const userList = document.getElementById('user-list');

    searchInput.addEventListener('input', handleSearch);
    userList.addEventListener('click', handleUserActions);

    function handleSearch(event) {
        const query = event.target.value.trim();
        if (query) {
            userForm.style.display = 'none';
            fetch(`/admin/search-users?q=${query}`)
                .then(response => response.json())
                .then(users => {
                    userList.innerHTML = users.map(user => `
                        <li class="user-item">
                            <input type="text" class="user-email" value="${user.email}" readonly>
                            <button class="admin-toggle ${user.isAdmin ? 'on' : 'off'}" data-id="${user._id}" data-isadmin="${user.isAdmin}">${user.isAdmin ? 'On' : 'Off'}</button>
                            <select class="subscription-status" data-id="${user._id}">
                                <option value="active" ${user.subscriptionStatus === 'active' ? 'selected' : ''}>Active</option>
                                <option value="inactive" ${user.subscriptionStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                            </select>
                            <button class="confirm-button" data-id="${user._id}">Confirm Changes</button>
                        </li>`).join('');
                })
                .catch(error => console.error('Error searching users:', error));
        } else {
            userForm.style.display = 'flex';
            userList.innerHTML = '';
        }
    }

    function handleUserActions(event) {
        const target = event.target;
        if (target.classList.contains('admin-toggle')) {
            toggleAdmin(target);
        } else if (target.classList.contains('confirm-button')) {
            handleConfirmChanges(event);
        }
    }

    function toggleAdmin(button) {
        const isAdmin = button.dataset.isadmin === 'true';
        button.dataset.isadmin = isAdmin ? 'false' : 'true';
        button.textContent = isAdmin ? 'Off' : 'On';
        button.classList.toggle('on', !isAdmin);
        button.classList.toggle('off', isAdmin);
    }

    async function handleConfirmChanges(event) {
        const button = event.target;
        const userId = button.dataset.id;
        const listItem = button.closest('.user-item');
        const email = listItem.querySelector('.user-email').value;
        const isAdmin = listItem.querySelector('.admin-toggle').dataset.isadmin === 'true';
        const subscriptionStatus = listItem.querySelector('.subscription-status').value;

        try {
            const response = await fetch('/admin/update-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId, email, isAdmin, subscriptionStatus })
            });
            if (response.ok) {
                button.style.display = 'none';
            } else {
                console.error('Error updating user');
            }
        } catch (error) {
            console.error('Error updating user:', error);
        }
    }

    userList.addEventListener('change', function(event) {
        const confirmButton = event.target.closest('.user-item').querySelector('.confirm-button');
        confirmButton.style.display = 'inline-block';
    });
});
