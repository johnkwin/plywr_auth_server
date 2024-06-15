document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('search-input');
    const userList = document.getElementById('user-list');

    searchInput.addEventListener('input', searchUsers);

    function searchUsers() {
        const query = searchInput.value.trim();
        fetch(`/admin/search-users?query=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(users => {
                userList.innerHTML = '';
                users.forEach(user => {
                    const userItem = document.createElement('li');
                    userItem.innerHTML = `
                        <span>
                            <input type="email" value="${user.email}" class="user-email" data-id="${user._id}">
                            <input type="checkbox" ${user.isAdmin ? 'checked' : ''} class="user-isAdmin" data-id="${user._id}">
                            <select class="user-subscriptionStatus" data-id="${user._id}">
                                <option value="active" ${user.subscriptionStatus === 'active' ? 'selected' : ''}>Active</option>
                                <option value="inactive" ${user.subscriptionStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                            </select>
                        </span>
                        <button class="confirm-button" data-id="${user._id}">Confirm</button>
                    `;
                    userList.appendChild(userItem);
                });
                attachEventListeners();
            });
    }

    function attachEventListeners() {
        document.querySelectorAll('.confirm-button').forEach(button => {
            button.addEventListener('click', function () {
                const userId = this.dataset.id;
                const email = document.querySelector(`.user-email[data-id="${userId}"]`).value;
                const isAdmin = document.querySelector(`.user-isAdmin[data-id="${userId}"]`).checked;
                const subscriptionStatus = document.querySelector(`.user-subscriptionStatus[data-id="${userId}"]`).value;

                fetch(`/admin/update-user/${userId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, isAdmin, subscriptionStatus })
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            alert('User updated successfully!');
                        } else {
                            alert('Failed to update user.');
                        }
                    });
            });
        });
    }
});
