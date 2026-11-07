"""
Import the whole app, every router included. A syntax error in a route no test
imported (coins.py, 7 Nov 2026) passed the suite and only failed on deploy.
"""


def test_the_whole_server_imports():
    import server
    paths = {r.path for r in server.app.routes}
    assert "/api/venues" in paths
    assert "/api/ratings" in paths
    assert "/api/pulse" in paths
