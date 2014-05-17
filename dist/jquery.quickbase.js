/*
 *  jQuery QuickBase - v1.0.1
 *  A client-size jQuery library for the Intuit QuickBase API.
 *  https://github.com/jarederaj/quickbase-jquery
 *
 *  Made by Jared
 *  Under MIT License
 */
/*
 *  jQuery QuickBase - v1.0.1
 *  A client-size jQuery library for the Intuit QuickBase API.
 *  https://github.com/jarederaj/quickbase-jquery
 *
 *  Authored by Joshua 
 *  Maintained by Jared
 *  Under MIT License
 */
(function($) {
	$.QuickBase = function(options, xml2json) {
		var defaults = {
            async: true,
			username: "",
			password: "",
			dbid: "",
			apptoken: undefined,
			realm: "www.quickbase.com"
		}, plugin = this;

		plugin.settings = {};
		plugin.payload = $("</qbdapi>");

		plugin.init = function(callback) {
			plugin.settings = $.extend({}, defaults, options);

			plugin.base_url = "https://" + plugin.settings.realm + "/db/";

			if(typeof plugin.token === "undefined" && typeof plugin.settings.apptoken === "undefined") {
				plugin.authenticate(undefined, undefined, undefined, function(response) {
					plugin.ticket = $(response).find("ticket").text();

					return typeof(callback) === "function" ? callback() : this;
				});
			}
			else {
				return typeof(callback) === "function" ? callback() : this;
			}
		};

		plugin.record = function(fid, value) {
			var id = isNaN(fid) ? "name=\"" + fid + "\"" : "fid=\"" + fid + "\"";

			return "<field " + id + ">" + value + "</field>";
		};

		function reset_payload() {
			plugin.payload = $("<qdbapi>");
			plugin.payload.append($("<ticket>").text(plugin.ticket));
			plugin.payload.append($("<apptoken>").text(plugin.settings.apptoken));
		}

		function get_raw_xml(payload) {
			return $("<div/>").append(payload.clone()).html();
		}

		function QuickBaseException(action, errcode, errtext, errdetail) {
			this.action = action;
			this.errcode = errcode;
			this.errtext = errtext;
			this.errdetail = errdetail;
            alert(errtext + "\n\n" + errdetail);
		}

		function handle_errors(e) {
			console.log(e);
			console.log(e.message);
		}

		function add_options_to_payload(options) {
			var prop, opt;

			if(typeof(options) === "object") {
				for(prop in options) {
					opt = "<" + prop + ">";
					plugin.payload.append($(opt).text(options[prop]));
				}
			}
		}

		function transmit(allowJson, action, payload, url, callback) {
			url = (url === "main") ?
				plugin.base_url + "main" :
				plugin.base_url + plugin.settings.dbid;

            reset_payload();
            window.loading.show();
			$.ajax({
				type: "POST",
				beforeSend: function(request) {
				  request.setRequestHeader("QUICKBASE-ACTION", action);
				},
				url: url,
				data: get_raw_xml(payload),
                async: plugin.settings.async,
				dataType: "xml",
				contentType: "text/xml",
				success: function(data) {
					var errcode = parseInt($(data).find("errcode").text(), 10),
						errtext, errdetail;

					try {
						if(errcode > 0) {
								errtext = $(data).find("errtext").text(),
								errdetail = $(data).find("errdetail").text();

							throw new QuickBaseException(action, errcode,
									errtext, errdetail);
						}

						reset_payload();

                        if(typeof(xml2json) === "function" && allowJson === true) {
                            data = xml2json(data);
                        }
						return typeof(callback) === "function" ? callback(data) : data;

					} catch (e) {
						handle_errors(e);
					}
				},
				error: function(xhr, ajaxOptions, thrownError) {
					console.log(xhr);
					console.log(ajaxOptions);
					console.log(thrownError);
				}
			});
            plugin.settings.async = true;
		}

		plugin.authenticate = function(username, password, hours, callback) {
			var payload = $("<qdbapi>");

			if(typeof username === "undefined") {
				username = plugin.settings.username;
			}

			if(typeof password === "undefined") {
				password = plugin.settings.password;
			}

			if(typeof hours === "undefined") {
				hours = ""; // use QB default of 12 hours
			}

            if(username === "" || password === "") {
                reset_payload();
                callback();
                return false;
            }
            payload.append($("<username>").text(username));
            payload.append($("<password>").text(password));
            payload.append($("<hours>").text(hours));

			transmit(false, "API_AUTHENTICATE", payload, "main", callback);
		};

		plugin.build_schema = function(callback) {
			var schema = {};

			transmit(false, "API_GetSchema", plugin.payload, "db", function(data) {

				try {
					var $chdbids = $(data).find("chdbid");
					if ($chdbids.length === 0) {
						throw "This operation requires a parent-level DBID.";
					}
				}
				catch (e) {
					handle_errors(e);
				}

				function build_schema_obj(index) {
					var $fields,
						$queries, f, q;

					plugin.settings.dbid = $($chdbids[index]).text();

					if(index+1 > $chdbids.length) {

						return typeof(callback) === "function" ? callback( schema ) : schema;

					} else {
						plugin.get_schema(function(data) {
							var $chdbid = $($chdbids[index]),
								   dbid = $chdbid.text(),
							 table_name = $chdbid.attr("name").substring("_dbid_".length);

							schema[table_name] = {"dbid": dbid};

							function build_fields_obj(i) {
								i = i || 0;

								if(i+1 > $fields.length) {
									$.extend(schema[table_name], f);

									return false;
								} else {
									var $field = $($fields[i]),
										field_label_raw = $field.find("label").text(),
										field_label = field_label_raw.toLowerCase().replace(/\W/g, "_"),
										field_id = $field.attr("id"),
										field_type = $field.attr("field_type");

									f.fields[field_label] = {id: field_id, label: field_label_raw, "field_type": field_type};

									build_fields_obj(i+1);
								}
							}

							function build_queries_obj(i) {
								i = i || 0;

								if(i+1 > $queries.length) {
									$.extend(schema[table_name], q);

									return false;
								} else {

									var $query = $($queries[i]);
										query_id = $query.attr("id"),
										query_name_raw = $query.find("qyname").text(),
										query_name = query_name_raw.toLowerCase().replace(/\W/g, "_");

									q.queries[query_name] = {id: query_id, name: query_name_raw};

									build_queries_obj(i+1);
								}
							}

							$fields = $(data).find("field"),
								f = {"fields": {}};

							if($fields.length) {
								build_fields_obj();
							}

							$queries = $(data).find("query"),
								q = {"queries": {}};

							if($queries.length) {
								build_queries_obj();
							}

							build_schema_obj(index+1);
						});
					}
				}

				return build_schema_obj(0);
			});
		};

		plugin.get_schema = function(callback) {
			transmit(false, "API_GetSchema", plugin.payload, "db", function(data) {
				return typeof(callback) === "function" ? callback(data) : data;
			});
		};

		plugin.add_record = function(records, options, callback) {
			if ($.isFunction(options)) {
				callback = options;
				options = undefined;
			}

			add_options_to_payload(options);

			$.each(records, function(index, value) {
                // Fuzzy comparison is intentional here.
                if(parseInt(index) == index) {
                    return plugin.payload.append($("<field>").attr({
                        fid: index
                    }).append(value));
                }
                return plugin.payload.append($("<field>").attr({
                    name: index
                }).append(value));
			});

			transmit(false, "API_AddRecord", plugin.payload, "db", function(data) {
			    return typeof(callback) === "function" ? callback(data) : data;
			});
		};

		plugin.delete_record = function(rid, options, callback) {
			if ($.isFunction(options)) {
				callback = options;
				options = undefined;
			}

			add_options_to_payload(options);

			plugin.payload.append("<rid>" + rid + "</rid>");

			transmit(false, "API_DeleteRecord", plugin.payload, "db", function(data) {
			    return typeof(callback) === "function" ? callback(data) : data;
			});
		};

		plugin.do_action = function(action, options, callback) {
            reset_payload();

			for (var prop in options) {
				opt = "<" + prop + ">";
				plugin.payload.append($(opt).text(options[prop]));
			}

			transmit(true, action, plugin.payload, "db", function(data) {
				return typeof(callback) === "function" ? callback(data) : data;
			});
		};

		plugin.do_query = function(query, options, callback) {
            options = $.extend({includeRids: 1}, options);
			var q = $("<qid>"),
				prop, opt;

			if(isNaN(query)) {
				q = Boolean(query.match("^[{]")) ? $("<query>") : $("<qname>");
			}

			plugin.payload.append(q.text(query));

			for (prop in options) {
				opt = "<" + prop + ">";
                var optVal = options[prop];
                if(typeof(optVal) === "string") {
                    optVal = optVal;
                }
				plugin.payload.append($(opt).text(optVal));
			}

			transmit(true, "API_DoQuery", plugin.payload, "db", function(data) {
				return typeof(callback) === "function" ? callback(data) : data;
			});
		};

		plugin.edit_record = function(rid, fields, options, callback) {
            var val;
			if ($.isFunction(options)) {
				callback = options;
				options = undefined;
			}
			add_options_to_payload(options);
			plugin.payload.append("<rid>" + rid + "</rid>");
			for (var key in fields) {
                val = fields[key];
                if(typeof(val) !== "undefined") {
                    if(parseInt(key) === key) {
                        plugin.payload.append($("<field>").attr({
                            fid: key
                        }).append(val));
                        continue;
                    }
                    plugin.payload.append($("<field>").attr({
                        name: key
                    }).append(val));
                }
            }
			transmit(false, "API_EditRecord", plugin.payload, "db", function(data) {
			    return typeof(callback) === "function" ? callback(data) : data;
			});
		};

		plugin.sign_out = function(udata, callback) {
			if ($.isFunction(udata)) {
				callback = udata;
				udata = undefined;
			}

			if(udata) {
				plugin.payload.append("<udata>" + udata + "</udata>");
			}

			transmit(false, "API_SignOut", plugin.payload, "main", function(data) {
			    return typeof(callback) === "function" ? callback(data) : data;
			});
		};

		return this;
  };
}(jQuery));
