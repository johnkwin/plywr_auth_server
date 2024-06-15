<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0"> <!-- Responsive meta tag -->
    <title>Admin Dashboard</title>
    <link rel="stylesheet" href="/css/styles.css">
</head>
<body class="dashboard-page">
    <div class="dashboard-container">
        <h2>Admin Dashboard</h2>
        <a href="/admin/logout" class="logout-button">Logout</a>

        <h3>Users</h3>
        <form action="/admin/user" method="POST" class="user-form" id="user-form">
            <input type="hidden" name="id" id="userId">
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required>
            <label for="password">Password:</label>
            <input type="password" id="password" name="password">
            <label for="isAdmin">Admin:</label>
            <input type="checkbox" id="isAdmin" name="isAdmin">
            <label for="subscriptionStatus">Subscription Status:</label>
            <select id="subscriptionStatus" name="subscriptionStatus">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <!-- Add more options if necessary -->
            </select>
            <button type="submit">Save User</button>
        </form>

        <h3>User List</h3>
        <ul class="user-list">
            <% users.forEach(user => { %>
                <li>
                    <span><%= user.email %> - <%= user.isAdmin ? 'Admin' : 'User' %> - <%= user.subscriptionStatus %></span>
                    <div>
                        <button class="edit-button" data-id="<%= user._id %>" data-email="<%= user.email %>" data-isadmin="<%= user.isAdmin %>" data-subscriptionstatus="<%= user.subscriptionStatus %>">Edit</button>
                        <form action="/admin/user/delete" method="POST" class="delete-form">
                            <input type="hidden" name="id" value="<%= user._id %>">
                            <button type="submit" class="delete-button">Delete</button>
                        </form>
                    </div>
                </li>
            <% }); %>
        </ul>
    </div>
    <script>
        document.querySelectorAll('.edit-button').forEach(button => {
            button.addEventListener('click', function() {
                document.getElementById('userId').value = this.dataset.id;
                document.getElementById('email').value = this.dataset.email;
                document.getElementById('isAdmin').checked = this.dataset.isadmin === 'true';
                document.getElementById('subscriptionStatus').value = this.dataset.subscriptionstatus;
            });
        });
    </script>
</body>
</html>
