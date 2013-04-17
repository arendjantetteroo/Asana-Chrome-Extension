
var init = function() {
  fillOptions();
  $("#reset_button").click(resetOptions);
};

// Restores select box state to saved value from localStorage.
var fillOptions = function() {
  var options = Asana.Options.loadOptions();
  $("#asana_host_port_input").val(options.asana_host_port);
  fillDomainsInBackground(options);
};

var fillDomainsInBackground = function(opt_options) {
  var options = opt_options || Asana.Options.loadOptions();
  Asana.ServerModel.workspaces(function(workspaces) {
    $("#domains_group").html("");
    workspaces.forEach(function(domain) {
      $("#domains_group").append(
          '<label><input name="default_domain_id" type="radio" id="default_domain_id-' +
              domain.id + '" key="' + domain.id + '"/>' + domain.name + '</label><br/>');
    });
    var default_domain_element = $("#default_domain_id-" + options.default_domain_id);
    if (default_domain_element[0]) {
      default_domain_element.prop("checked", "checked");
    } else {
      $("#domains_group").find("input")[0].checked = true;
    }
    $("#domains_group").find("input").change(onChange);
    $("#domains_group").find("input").change(fillProjectsInBackground);
    fillProjectsInBackground();
  }, function(error_response) {
    $("#domains_group").html(
        '<div>Error loading workspaces. Verify the following:<ul>' +
            '<li>Asana Host is configured correctly.</li>' +
            '<li>You are <a target="_blank" href="' +
            Asana.Options.loginUrl() +
            '">logged in</a>.</li>' +
            '<li>You have access to the Asana API.</li></ul>');
  });
};

var fillProjectsInBackground = function(opt_options) {
  var options = opt_options || Asana.Options.loadOptions();
  options.default_domain_id = $("#domains_group input:checked").attr("key");
  Asana.ServerModel.projectsInWorkspace(options.default_domain_id, function(projects) {
    $("#projects_group").html("");
    projects.forEach(function(project) {
      projectinput = '<label><input name="default_project_id" type="radio" id="default_project_id-' +
              project.id + '" key="' + project.id + '"';
     if (options.default_project_id == project.id) {
          // Check the default project
         projectinput += 'checked=checked';
      }
      projectinput += '/>' +project.name + '</label><br/>';
      $("#projects_group").append(projectinput);
    });
    projectinput = '<label><input name="default_project_id" type="radio" id="default_project_id-0" key="0"';
    if (options.default_project_id == 0) {
          // Check the default project
         projectinput += 'checked=checked';
    }
    projectinput += '/>---Don\'t assign a Project---</label><br/>';
    $("#projects_group").append(projectinput);
    $("#projects_group").find("input").change(onChange);
  }, function(error_response) {
    $("#projects_group").html(
        '<div>Error loading projects. Verify the following:<ul>' +
            '<li>Asana Host is configured correctly.</li>' +
            '<li>You are <a target="_blank" href="' +
            Asana.Options.loginUrl() +
            '">logged in</a>.</li>' +
            '<li>You have access to the Asana API.</li></ul>');
  });
};

var onChange = function() {
  setSaveEnabled(true);
};

var setSaveEnabled = function(enabled) {
  var button = $("#save_button");
  if (enabled) {
    button.removeClass("disabled");
    button.addClass("enabled");
    button.click(saveOptions);
  } else {
    button.removeClass("enabled");
    button.addClass("disabled");
    button.unbind('click');
  }
};

var resetOptions = function() {
  Asana.Options.resetOptions();
  fillOptions();
  setSaveEnabled(false);
};

var saveOptions = function() {
  var asana_host_port = $("#asana_host_port_input").val();
  var default_domain_input = $("#domains_group input:checked");
  var default_project_input = $("#projects_group input:checked");
  Asana.Options.saveOptions({
    asana_host_port: asana_host_port,
    default_domain_id: default_domain_input
        ? default_domain_input.attr("key")
        : 0,
    default_project_id: default_project_input
        ? default_project_input.attr("key")
        : 0        
  });
  setSaveEnabled(false);
  $("#status").html("Options saved.");
  setTimeout(function() {
    $("#status").html("");
  }, 3000);

  fillDomainsInBackground();
};