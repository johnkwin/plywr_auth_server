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
                    userItem.className = 'user-item';
                    userItem.innerHTML = `
                        <span>
                            <input type="email" value="${user.email}" class="user-email" data-id="${user._id}">
                            <button class="toggle-admin ${user.isAdmin ? 'on' : 'off'}" data-id="${user._id}">
                                ${user.isAdmin ? 'On' : 'Off'}
                            </button>
                            <select class="user-subscriptionStatus" data-id="${user._id}">
                                <option value="active" ${user.subscriptionStatus === 'active' ? 'selected' : ''}>Active</option>
                                <option value="inactive" ${user.subscriptionStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
                            </select>
                        </span>
                        <button class="confirm-button" data-id="${user._id}" style="display: none;">Confirm</button>
                    `;
                    userList.appendChild(userItem);
                });
                attachEventListeners();
            });
    }

    function attachEventListeners() {
        document.querySelectorAll('.user-email, .user-subscriptionStatus').forEach(input => {
            input.addEventListener('input', function () {
                const userId = this.dataset.id;
                const confirmButton = document.querySelector(`.confirm-button[data-id="${userId}"]`);
                confirmButton.style.display = 'inline-block';
            });
        });

        document.querySelectorAll('.toggle-admin').forEach(button => {
            button.addEventListener('click', function () {
                const userId = this.dataset.id;
                const isOn = this.classList.contains('on');
                this.classList.toggle('on', !isOn);
                this.classList.toggle('off', isOn);
                this.textContent = !isOn ? 'On' : 'Off';

                const confirmButton = document.querySelector(`.confirm-button[data-id="${userId}"]`);
                confirmButton.style.display = 'inline-block';
            });
        });

        document.querySelectorAll('.confirm-button').forEach(button => {
            button.addEventListener('click', function () {
                const userId = this.dataset.id;
                const email = document.querySelector(`.user-email[data-id="${userId}"]`).value;
                const isAdmin = document.querySelector(`.toggle-admin[data-id="${userId}"]`).classList.contains('on');
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
                            button.style.display = 'none';
                        } else {
                            alert('Failed to update user.');
                        }
                    });
            });
        });
    }
});
