$(document).ready(function() {

  var engine_name = $('#layout-engine').text();
  var test_compat = ($('#test-set').text() == "backwards-compatible");
  var last_results;

  function getJSON(url) {
    return fetch(url)
      .then(function(response) {
        return response.json()
      }).catch(function(ex) {
        console.log('JSON parsing failed for ' + url + ": ", ex)
      });
  }

  try {

    getJSON("cases/tests.json")
      .then(
        function(test_cases) {

          console.log("%o", test_cases);

          // For each test case, fetch the original tree, and the expected.
          // (This isn't quite ideal -- I'd rather retrieve the tree and the 
          // expected in parallel, but I couldn't figure out how to do that.)
          // FIXME: check that I get good error reporting on JSON errors
          return Promise.all(
            test_cases.map(function(test_case) {
                return getJSON("cases/" + test_case.tree)
                  .then(function(tree_json) {
                    test_case.tree_json = tree_json;
                    return test_case;
                  })
                  .then(function(test_case) {
                    if (test_case.name == "flare") return test_case;
                    return getJSON("cases/" + test_case.name + ".expected.json")
                      .then(function(expected_json) {
                        test_case.expected_json = expected_json;
                        return test_case;
                      })
                  });
            })
          );
        }
      )
      .then(
        function(test_cases) {
          console.log("%o", test_cases);
          function summarize(msg) {
            $('#summary').append('<li>' + msg + "</li>");
          }

          for (var i = 0; i < test_cases.length; ++i) {
            var test_case = test_cases[i];

            // FIXME: just run test16
            //continue;
            //if (test_case.name != 'test22') continue;

            if (test_case.skip) {
              summarize('Skipping test ' + test_case.name + 
                ", because skip == true");
              continue;
            }

            var layout_engine = d3.layout[engine_name]();

            // gap
            if (test_case.gap == "separation-1") {
              layout_engine.separation(function(a, b) { return 1; });
            }
            else if (test_case.gap == "spacing-0") {
              if (test_compat) {
                summarize("Skipping test " + test_case.name + 
                  ", because existing D3 doesn't do spacing");
                continue;
              }
              layout_engine.spacing(function(a, b) { return 0; });
            }
            else if (test_case.gap == "spacing-custom") {
              if (test_compat) {
                summarize("Skipping test " + test_case.name + 
                  ", because existing D3 doesn't do spacing");
                continue;
              }
              layout_engine.spacing(function(a, b) {
                return a.parent == b.parent ? 
                  0 : layout_engine.rootXSize();
              })
            }

            // sizing
            if (test_case.sizing == "node-size-function") {
              if (test_compat) {
                summarize("Skipping test " + test_case.name + 
                  ", because existing D3 doesn't do nodeSize as a function");
                continue;
              }
              layout_engine.nodeSize(function(t) {
                return [t.x_size, t.y_size];
              })
            }
            else if (test_case.sizing == "node-size-fixed") {
              layout_engine.nodeSize([50, 50]);
            }
            else if (test_case.sizing == "size") {
              layout_engine.size([200, 100]);
            }

            summarize('Running test ' + test_case.name);
            var tree = test_case.tree_json;
            var nodes = layout_engine.nodes(tree);

            print_results(test_case, true, tree);

            last_results = {
              addr: [0],
            };
            if (!tree_equals(tree, test_case.expected_json)) {
              fail(test_case.name + " failed: results != expected");
              print_results(test_case, false, test_case.expected_json);
            }
          }
        }
      );
  }
  catch(error) {
    alert("failed: " + error);
  }

  function print_results(test_case, results, tree) {
    $('body').append(
      "<div><p>Test " + test_case.name + " " +
      (results ? "results" : "expected") + ":</p>\n" +
      "<pre>" + JSON.stringify(tree, ["x", "y", "children"], 2) +
      "</pre></div>"
    );

  }

  function almost_equals(a, b, label) {
    if (a == 0 && b == 0) return true;
    if (! ( Math.abs((b-a) / (b+a)) < 0.000000000001 ) ) {
      last_results.found = a;
      last_results.expected = b;
      last_results.label = label;
      return false;
    }
    return true;
  }

  function tree_equals(a, b) {
    if (!almost_equals(a.x, b.x, "x") || !almost_equals(a.y, b.y, "y")) 
      return false;

    var a_num_children = a.children ? a.children.length : 0;
    var b_num_children = b.children ? b.children.length : 0;
    if (!almost_equals(a_num_children, b_num_children, "num_children")) 
      return false;
    if (a_num_children > 0) {
      var i;
      for (i = 0; i < a_num_children; ++i) {
        last_results.addr.push(i);
        if (!tree_equals(a.children[i], b.children[i])) return false;
        last_results.addr.pop();
      }
    }
    return true;
  }

  function fail(e) {
    alert("Failed: " + (typeof e == "string" ? e : e.stack) + "\n" +
      "node address: " + last_results.addr.join(", ") + "\n" +
      "found: " + last_results.found + "\n" +
      "expected: " + last_results.expected + "\n" +
      "label: " + last_results.label);
  }
});
