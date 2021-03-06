window.addEventListener('load', function() {

  // Our default error handler.
  Asana.ServerModel.onError = function(response) {
    showError(response.errors[0].message);
  };

  // Ah, the joys of asynchronous programming.
  // To initialize, we've got to gather various bits of information.
  // Starting with a reference to the window and tab that were active when
  // the popup was opened ...
  chrome.windows.getCurrent(function(w) {
    chrome.tabs.query({
      active: true,
      windowId: w.id
    }, function(tabs) {
      // Now load our options ...
      Asana.ServerModel.options(function(options) {
        // And ensure the user is logged in ...
        Asana.ServerModel.isLoggedIn(function(is_logged_in) {
          if (is_logged_in) {
            if (window.quick_add_request) {
              // If this was a QuickAdd request (set by the code popping up
              // the window in Asana.ExtensionServer), then we have all the
              // info we need and should show the add UI right away.
              showAddUi(
                  quick_add_request.url, quick_add_request.title,
                  quick_add_request.selected_text, options);
            } else {
              // Otherwise we want to get the selection from the tab that
              // was active when we were opened. So we set up a listener
              // to listen for the selection send event from the content
              // window ...
              var selection = "";
              var listener = function(request, sender, sendResponse) {
                if (request.type === "selection") {
                  chrome.extension.onRequest.removeListener(listener);
                  console.info("Asana popup got selection");
                  selection = "\n" + request.value;
                }
              };
              chrome.extension.onRequest.addListener(listener);

              // ... and then we make a request to the content window to
              // send us the selection.
              var tab = tabs[0];
              chrome.tabs.executeScript(tab.id, {
                code: "(Asana && Asana.SelectionClient) ? Asana.SelectionClient.sendSelection() : 0"
              }, function() {
                // The requests appear to be handled synchronously, so the
                // selection should have been sent by the time we get this
                // completion callback. If the timing ever changes, however,
                // that could break and we would never show the add UI.
                // So this could be made more robust.
                showAddUi(tab.url, tab.title, selection, options);
              });
            }
          } else {
            // The user is not even logged in. Prompt them to do so!
            showLogin(Asana.Options.loginUrl(options));
          }
        });
      });
    });
  });
});

// Helper to show a named view.
var showView = function(name) {
  ["login", "add", "success"].forEach(function(view_name) {
    $("#" + view_name + "_view").css("display", view_name === name ? "" : "none");
  });
};

// Show the add UI
var showAddUi = function(url, title, selected_text, options) {
  var self = this;
  showView("add");
  $("#notes").val(url + selected_text);
  $("#name").val(title);
  $("#name").focus();
  $("#name").select();
  Asana.ServerModel.me(function(user) {
    // Just to cache result.
    Asana.ServerModel.workspaces(function(workspaces) {
      $("#workspace").html("");
      workspaces.forEach(function(workspace) {
        $("#workspace").append(
            "<option value='" + workspace.id + "'>" + workspace.name + "</option>");
      });
      $("#workspace").val(options.default_domain_id);
      onWorkspaceChanged();
      $("#workspace").change(onWorkspaceChanged);
    });
  });
};

// Enable/disable the add button.
var setAddEnabled = function(enabled) {
  var button = $("#add_button");
  if (enabled) {
    button.removeClass("disabled");
    button.addClass("enabled");
    button.click(function() {
      createTask();
      return false;
    });
    button.keydown(function(e) {
      if (e.keyCode === 13) {
        createTask();
      }
    });
  } else {
    button.removeClass("enabled");
    button.addClass("disabled");
    button.unbind('click');
    button.unbind('keydown');
  }
};

// Set the add button as being "working", waiting for the Asana request
// to complete.
var setAddWorking = function(working) {
  setAddEnabled(!working);
  $("#add_button").find(".button-text").text(
      working ? "Adding..." : "Add to Asana");
};

// When the user changes the workspace, update the list of users and projects.
var onWorkspaceChanged = function() {
  var workspace_id = readWorkspaceId();
  $("#assignee").html("<option>Loading...</option>");
  setAddEnabled(false);

  // Get the available projects in the selected workspace
  Asana.ServerModel.projectsInWorkspace(workspace_id, function(projects) {
      $("#project").html("");
      Asana.ServerModel.options(function(options) {
        // Add a no project option
        option = "<option value='0'>---Don\'t assign a Project---</option>";
        $("#project").append(option);

        // Add all available projects in this workspace
        projects.forEach(function(project) {
            option = "<option value='" + project.id + "'";
            if (options.default_project_id == project.id) {
              // The default project is in this workspace, check it
              option += 'selected=selected';
            }
            option += ">" + project.name + "</option>";
            $("#project").append(option);
          });          
      });
  });

  // Get the available users in the selected workspace
  Asana.ServerModel.users(workspace_id, function(users) {
    $("#assignee").html("");
    users = users.sort(function(a, b) {
      return (a.name < b.name) ? -1 : ((a.name > b.name) ? 1 : 0);
    });
    $("#assignee").append(
          "<option value='0'>---Don\'t assign a User</option>");
    users.forEach(function(user) {
      $("#assignee").append(
          "<option value='" + user.id + "'>" + user.name + "</option>");
    });
    Asana.ServerModel.me(function(user) {
      $("#assignee").val(user.id);
    });
    setAddEnabled(true);
  });
};

var readAssignee = function() {
  return $("#assignee").val();
};

var readWorkspaceId = function() {
  return $("#workspace").val();
};

var readProjectId = function() {
  return $("#project").val();
};

var createTask = function() {
  console.info("Creating task");
  hideError();
  setAddWorking(true);
  
  taskdata = {
        name: $("#name").val(),
        notes: $("#notes").val()
  };
  
  // Check if we need to assign somebody, and if so, include the taskstatus as well
  assignee = readAssignee();
  if (assignee > 0) {
    taskdata.assignee = assignee;
    taskdata.assignee_status = $("#status").val();
  }
  
  //Create the task
  Asana.ServerModel.createTask(
      readWorkspaceId(),
      taskdata,
      function(task) {
        projectId = readProjectId();
        if(projectId > 0) {
          // Only do an addProject if we have a project
          Asana.ServerModel.addProject(
            task.id,
            readProjectId(),
            function(response) {
              setAddWorking(false);
              showSuccess(task);
            },
            function(response) {
              setAddWorking(false);
              showError(response.errors[0].message);
            });
        } else {
          setAddWorking(false);
          showSuccess(task);
        }
      },
      function(response) {
        setAddWorking(false);
        showError(response.errors[0].message);
      });
};

var showError = function(message) {
  console.log("Error: " + message);
  $("#error").css("display", "");
};

var hideError = function() {
  $("#error").css("display", "none");
};

// Helper to show a success message after a task is added.
var showSuccess = function(task) {
  Asana.ServerModel.taskViewUrl(task, function(url) {
    var name = task.name.replace(/^\s*/, "").replace(/\s*$/, "");
    $("#new_task_link").attr("href", url);
    $("#new_task_link").text(name !== "" ? name : "unnamed task");
    $("#new_task_link").unbind("click");
    $("#new_task_link").click(function() {
      chrome.tabs.create({url: url});
      window.close();
      return false;
    });
    showView("success");
  });
};

// Helper to show the login page.
var showLogin = function(url) {
  $("#login_link").attr("href", url);
  $("#login_link").unbind("click");
  $("#login_link").click(function() {
    chrome.tabs.create({url: url});
    window.close();
    return false;
  });
  showView("login");
};

// Close the popup if the ESCAPE key is pressed.
window.addEventListener("keydown", function(e) {
  if (e.keyCode === 27) {
    window.close();
  }
}, /*capture=*/false);

$("#close-banner").click(function() { window.close(); });
