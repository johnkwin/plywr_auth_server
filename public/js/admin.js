document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search');
    const userList = document.getElementById('user-list');
    const newUserForm = document.getElementById('new-user-form');
    const userCreationForm = document.getElementById('user-creation-form');

    function renderUsers(users) {
        userList.innerHTML = '';
        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.classList.add('user-item');
            userItem.innerHTML = `
                <div>
                    <input type="text" class="user-email" value="${user.email}" disabled>
                    <button class="admin-toggle" data-isadmin="${user.isAdmin}" style="background: ${user.isAdmin ? '#28a745' : '#6c757d'}">${user.isAdmin ? 'On' : 'Off'}</button>
                    <select class="subscription-status">
                        <option value="active" ${user.subscriptionStatus === 'active' ? 'selected' : ''}>Active</option>
                        <option value="inactive" ${user.subscriptionStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>
                <button class="confirm-button" data-id="${user._id}">Confirm Changes</button>
            `;

            userList.appendChild(userItem);
        });
    }

    function handleSearch(event) {
        const query = event.target.value;
        if (query) {
            fetch(`/admin/search-users?q=${query}`)
                .then(response => response.json())
                .then(data => renderUsers(data))
                .catch(error => console.error('Error searching users:', error));
            userCreationForm.style.display = 'none';
        } else {
            userList.innerHTML = '';
            userCreationForm.style.display = 'block';
        }
    }

    searchInput.addEventListener('input', handleSearch);

    userList.addEventListener('click', function (event) {
        if (event.target.classList.contains('admin-toggle')) {
            const button = event.target;
            const isAdmin = button.dataset.isadmin === 'true';
            button.dataset.isadmin = !isAdmin;
            button.textContent = !isAdmin ? 'On' : 'Off';
            button.style.background = !isAdmin ? '#28a745' : '#6c757d';
        }

        if (event.target.classList.contains('confirm-button')) {
            const button = event.target;
            const userId = button.dataset.id;
            const listItem = button.closest('.user-item');
            const email = listItem.querySelector('.user-email').value;
            const isAdmin = listItem.querySelector('.admin-toggle').dataset.isadmin === 'true';
            const subscriptionStatus = listItem.querySelector('.subscription-status').value;

            fetch('/admin/update-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId, email, isAdmin, subscriptionStatus })
            })
                .then(response => response.json())
                .then(() => {
                    button.style.display = 'none';
                })
                .catch(error => console.error('Error updating user:', error));
        }
    });

    userList.addEventListener('change', function (event) {
        const confirmButton = event.target.closest('.user-item').querySelector('.confirm-button');
        confirmButton.style.display = 'inline-block';
    });
});
